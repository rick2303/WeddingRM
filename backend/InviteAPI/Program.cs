using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Dapper;

var builder = WebApplication.CreateBuilder(args);

// =======================
//  Configuración de CORS
// =======================
var originsFromConfig = builder.Configuration["FrontendOrigins"]; 

var allowedOrigins = originsFromConfig?
    .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? new[] { "http://localhost:5173" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// =======================
//   Configuración JWT
// =======================
var jwtSection = builder.Configuration.GetSection("Jwt");
builder.Services.Configure<JwtSettings>(jwtSection);

var jwtSettings = jwtSection.Get<JwtSettings>() ?? throw new Exception("Jwt settings missing");
var key = Encoding.UTF8.GetBytes(jwtSettings.Key);
var isDevelopment = builder.Environment.IsDevelopment();

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = !isDevelopment; // true en prod, false en dev
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidAudience = jwtSettings.Audience,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// =======================
//  Repositorios con BD
// =======================
var connectionString =
    builder.Configuration.GetConnectionString("DefaultConnection")
    ?? builder.Configuration["DatabaseConnection"]
    ?? throw new Exception("Database connection string missing");

builder.Services.AddSingleton<IInviteRepository>(_ =>
    new DbInviteRepository(connectionString));

builder.Services.AddSingleton<ISettingsRepository>(_ =>
    new DbSettingsRepository(connectionString));


// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseCors("FrontendPolicy");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// >>> NUEVO: archivos estáticos para servir /uploads/...
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

// =======================
//      ENDPOINTS
// =======================

app.MapGet("/", () => Results.Ok("InviteAPI running 🚀"));

// -----------------------
//        AUTH
// -----------------------
app.MapPost("/api/auth/login", (LoginRequest request, IConfiguration config) =>
{
    var adminSection = config.GetSection("AdminUser");
    var adminEmail = adminSection.GetValue<string>("Email");
    var adminPassword = adminSection.GetValue<string>("Password");

    if (!string.Equals(request.Email, adminEmail, StringComparison.OrdinalIgnoreCase) ||
        request.Password != adminPassword)
    {
        return Results.Unauthorized();
    }

    var jwtSettings = config.GetSection("Jwt").Get<JwtSettings>()!;
    var key = Encoding.UTF8.GetBytes(jwtSettings.Key);
    var claims = new List<Claim>
    {
        new Claim(JwtRegisteredClaimNames.Sub, adminEmail!),
        new Claim(JwtRegisteredClaimNames.Email, adminEmail!),
        new Claim(ClaimTypes.Name, adminEmail!),
        new Claim(ClaimTypes.Role, "Admin")
    };

    var creds = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256);
    var expires = DateTime.UtcNow.AddMinutes(jwtSettings.ExpiryMinutes);

    var tokenDescriptor = new JwtSecurityToken(
        issuer: jwtSettings.Issuer,
        audience: jwtSettings.Audience,
        claims: claims,
        expires: expires,
        signingCredentials: creds
    );

    var token = new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);

    var response = new LoginResponse(
        Token: token,
        Email: adminEmail!,
        Role: "Admin",
        ExpiresAt: expires
    );

    return Results.Ok(response);
})
.WithName("Login")
.WithTags("Auth");

app.MapGet("/api/auth/me", (ClaimsPrincipal user) =>
{
    if (!user.Identity?.IsAuthenticated ?? true)
    {
        return Results.Unauthorized();
    }

    var email = user.FindFirst(ClaimTypes.Email)?.Value
                ?? user.FindFirst(JwtRegisteredClaimNames.Email)?.Value
                ?? user.Identity!.Name;

    var role = user.FindFirst(ClaimTypes.Role)?.Value ?? "Unknown";

    return Results.Ok(new
    {
        Email = email,
        Role = role
    });
})
.RequireAuthorization()
.WithName("Me")
.WithTags("Auth");

// -----------------------
//  SETTINGS (EXPIRACIÓN)
// -----------------------
// GET global expiration
app.MapGet("/api/settings/invite-expiration", (IInviteRepository repo) =>
{
    var current = repo.GetGlobalExpiration();
    if (current is null) return Results.NoContent();
    return Results.Ok(new { expiresAt = current.Value });
})
.RequireAuthorization()
.WithTags("Settings");

// PUT global expiration
app.MapPut("/api/settings/invite-expiration",
    (InviteExpirationRequest req, IInviteRepository repo) =>
    {
        var utc = DateTime.SpecifyKind(req.ExpiresAt, DateTimeKind.Utc);
        repo.SetGlobalExpiration(utc);
        return Results.Ok(new { expiresAt = utc });
    })
.RequireAuthorization()
.WithTags("Settings");


// GET público de info de evento
app.MapGet("/api/settings/event", (ISettingsRepository repo) =>
{
    var ev = repo.GetEvent() ?? new EventSettings();
    return Results.Ok(new
    {
        title = ev.Title,
        subtitle = ev.Subtitle,
        description = ev.Description,
        location = ev.Location,
        dateText = ev.DateText,
        imageUrl = ev.ImageUrl
    });
})
.WithTags("Settings");

// PUT solo admin (texto del evento)
app.MapPut("/api/settings/event",
    (UpdateEventRequest req, ISettingsRepository repo) =>
    {
        var ev = repo.GetEvent() ?? new EventSettings();

        ev.Title = req.Title;
        ev.Subtitle = req.Subtitle;
        ev.Description = req.Description;
        ev.Location = req.Location;
        ev.DateText = req.DateText;

        if (!string.IsNullOrWhiteSpace(req.ImageUrl))
        {
            ev.ImageUrl = req.ImageUrl;
        }

        repo.SaveEvent(ev);

        return Results.Ok(new
        {
            title = ev.Title,
            subtitle = ev.Subtitle,
            description = ev.Description,
            location = ev.Location,
            dateText = ev.DateText,
            imageUrl = ev.ImageUrl
        });
    })
.RequireAuthorization()
.WithTags("Settings");

// POST imagen del evento (solo admin)
app.MapPost("/api/settings/event-image",
    async (HttpRequest http,
           IWebHostEnvironment env,
           ISettingsRepository repo) =>
    {
        if (!http.HasFormContentType)
        {
            return Results.BadRequest(new { message = "Contenido inválido." });
        }

        var form = await http.ReadFormAsync();
        var file = form.Files["file"];
        if (file is null || file.Length == 0)
        {
            return Results.BadRequest(new { message = "Archivo vacío o faltante." });
        }

        var webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
        var uploadsDir = Path.Combine(webRoot, "uploads");
        Directory.CreateDirectory(uploadsDir);

        var extension = Path.GetExtension(file.FileName);
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(uploadsDir, fileName);

        await using (var stream = File.Create(filePath))
        {
            await file.CopyToAsync(stream);
        }

        var baseUrl = $"{http.Scheme}://{http.Host}";
        var publicUrl = $"{baseUrl}/uploads/{fileName}";

        var ev = repo.GetEvent() ?? new EventSettings();
        ev.ImageUrl = publicUrl;
        repo.SaveEvent(ev);

        return Results.Ok(new { imageUrl = publicUrl });
    })
.RequireAuthorization()
.WithTags("Settings");

// -----------------------
//       INVITES API
// -----------------------

// Listar todas (ADMIN)
app.MapGet("/api/invites", (IInviteRepository repo) =>
    Results.Ok(repo.GetAll().Select(i => i.ToResponse()))
)
.RequireAuthorization()
.WithTags("Invites");

// Crear invitación (ADMIN)
app.MapPost("/api/invites", (CreateInviteRequest request, IInviteRepository repo) =>
{
    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
    {
        return Results.BadRequest(new { message = "Nombre y teléfono son obligatorios." });
    }

    if (!InviteValidation.IsValidPhone(request.Phone))
    {
        return Results.BadRequest(new
        {
            message = "Teléfono inválido. Usa formato +504######## o +1##########."
        });
    }

    var invite = repo.Add(request.Name.Trim(), request.Phone.Trim());
    return Results.Created($"/api/invites/{invite.Id}", invite.ToResponse());
})
.RequireAuthorization()
.WithTags("Invites");

// Actualizar invitación (ADMIN)
app.MapPut("/api/invites/{id:guid}", (Guid id, UpdateInviteRequest request, IInviteRepository repo) =>
{
    if (!string.IsNullOrWhiteSpace(request.Phone) &&
        !InviteValidation.IsValidPhone(request.Phone))
    {
        return Results.BadRequest(new
        {
            message = "Teléfono inválido. Usa formato +504######## o +1##########."
        });
    }

    var statusEnum = InviteMappings.ParseStatus(request.Status);
    var updated = repo.Update(id, request.Name, request.Phone, statusEnum);
    if (updated is null) return Results.NotFound();

    return Results.Ok(updated.ToResponse());
})
.RequireAuthorization()
.WithTags("Invites");

// Eliminar (ADMIN)
app.MapDelete("/api/invites/{id:guid}", (Guid id, IInviteRepository repo) =>
{
    var ok = repo.Remove(id);
    return ok ? Results.NoContent() : Results.NotFound();
})
.RequireAuthorization()
.WithTags("Invites");

// ---------- INVITADO (PÚBLICO) ----------

// GET por token
app.MapGet("/api/public/invites/{token}", (string token, IInviteRepository repo) =>
{
    var invite = repo.GetByToken(token);
    if (invite is null)
        return Results.NotFound(new { message = "Invitación no encontrada." });

    if (InviteValidation.IsExpired(invite))
        return Results.BadRequest(new { message = "La invitación ha expirado." });

    return Results.Ok(invite.ToResponse());
})
.WithTags("Invites");

// Responder por token
app.MapPost("/api/public/invites/{token}/respond",
    (string token, RespondInviteRequest request, IInviteRepository repo) =>
    {
        var invite = repo.GetByToken(token);
        if (invite is null)
            return Results.NotFound(new { message = "Invitación no encontrada." });

        if (InviteValidation.IsExpired(invite))
            return Results.BadRequest(new { message = "La invitación ha expirado." });

        var statusEnum = InviteMappings.ParseStatus(request.Status);
        if (statusEnum is null || statusEnum == InviteStatus.Pending)
        {
            return Results.BadRequest(new
            {
                message = "Status inválido. Usa 'confirmed' o 'rejected'."
            });
        }

        invite.Status = statusEnum.Value;

        // guardar cambios
        repo.Update(invite.Id, invite.Name, invite.Phone, invite.Status);

        return Results.Ok(invite.ToResponse());
    })
.WithTags("Invites");

app.Run();

// =======================
//      CLASES AUX AUTH
// =======================

public record LoginRequest(string Email, string Password);

public record LoginResponse(
    string Token,
    string Email,
    string Role,
    DateTime ExpiresAt
);

public class JwtSettings
{
    public string Key { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public int ExpiryMinutes { get; set; }
}

// =======================
//     INVITES DOMAIN
// =======================

public enum InviteStatus
{
    Pending,
    Confirmed,
    Rejected
}

public class Invite
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string Phone { get; set; }
    public required string Token { get; set; }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public InviteStatus Status { get; set; } = InviteStatus.Pending;

    public DateTime ExpiresAt { get; set; } // UTC
}

public interface IInviteRepository
{
    IEnumerable<Invite> GetAll();
    Invite? GetById(Guid id);
    Invite? GetByToken(string token);
    Invite Add(string name, string phone);
    Invite? Update(Guid id, string? name, string? phone, InviteStatus? status);
    bool Remove(Guid id);

    // Expiración global
    DateTime? GetGlobalExpiration();
    void SetGlobalExpiration(DateTime expiresAtUtc);
}


// =======================
//   VALIDACIONES
// =======================

public static class InviteValidation
{
    private static readonly Regex PhoneRegex =
        new(@"^\+(504\d{8}|1\d{10})$", RegexOptions.Compiled);

    public static bool IsValidPhone(string phone) =>
        PhoneRegex.IsMatch(phone);

    public static bool IsExpired(Invite invite)
    {
        // Si no tiene fecha (default), no lo tratamos como expirado
        if (invite.ExpiresAt == default) return false;
        return invite.ExpiresAt <= DateTime.UtcNow;
    }
}

// =======================
//   FILE-BASED REPO
// =======================
/*
public class FileInviteRepository : IInviteRepository
{
    private readonly string _filePath;
    private readonly object _lock = new();
    private readonly List<Invite> _invites;

    public FileInviteRepository(string filePath)
    {
        _filePath = filePath;
        _invites = LoadFromFile();
    }

    public IEnumerable<Invite> GetAll()
    {
        lock (_lock)
        {
            return _invites.Select(i => i).ToList();
        }
    }

    public Invite? GetById(Guid id)
    {
        lock (_lock)
        {
            return _invites.FirstOrDefault(i => i.Id == id);
        }
    }

    public Invite? GetByToken(string token)
    {
        lock (_lock)
        {
            return _invites.FirstOrDefault(i =>
                string.Equals(i.Token, token, StringComparison.OrdinalIgnoreCase));
        }
    }

    /// <summary>
    /// Obtiene la expiración "global" actual:
    /// toma el ExpiresAt máximo de las invitaciones que lo tengan seteado.
    /// </summary>
    public DateTime? GetGlobalExpiration()
    {
        lock (_lock)
        {
            var valid = _invites
                .Where(i => i.ExpiresAt != default)
                .ToList();

            if (!valid.Any()) return null;

            return valid.Max(i => i.ExpiresAt);
        }
    }

    /// <summary>
    /// Setea la misma fecha de expiración para TODAS las invitaciones
    /// y la persiste en el archivo.
    /// </summary>
    public void SetGlobalExpiration(DateTime expiresAtUtc)
    {
        lock (_lock)
        {
            foreach (var i in _invites)
            {
                i.ExpiresAt = expiresAtUtc;
            }

            SaveToFile();
        }
    }

    public Invite Add(string name, string phone)
    {
        lock (_lock)
        {
            // Usa la expiración global si existe, si no 7 días desde ahora
            var global = GetGlobalExpiration();
            var expiresAt = global ?? DateTime.UtcNow.AddDays(7);

            var invite = new Invite
            {
                Id = Guid.NewGuid(),
                Name = name,
                Phone = phone,
                Token = Guid.NewGuid().ToString("N")[..10],
                Status = InviteStatus.Pending,
                ExpiresAt = expiresAt
            };

            _invites.Add(invite);
            SaveToFile();
            return invite;
        }
    }

    public Invite? Update(Guid id, string? name, string? phone, InviteStatus? status)
    {
        lock (_lock)
        {
            var invite = _invites.FirstOrDefault(i => i.Id == id);
            if (invite is null) return null;

            if (!string.IsNullOrWhiteSpace(name))
                invite.Name = name;

            if (!string.IsNullOrWhiteSpace(phone))
                invite.Phone = phone;

            if (status.HasValue)
                invite.Status = status.Value;

            SaveToFile();
            return invite;
        }
    }

    public bool Remove(Guid id)
    {
        lock (_lock)
        {
            var invite = _invites.FirstOrDefault(i => i.Id == id);
            if (invite is null) return false;

            _invites.Remove(invite);
            SaveToFile();
            return true;
        }
    }

    private List<Invite> LoadFromFile()
    {
        if (!File.Exists(_filePath))
        {
            return new List<Invite>();
        }

        var json = File.ReadAllText(_filePath);
        if (string.IsNullOrWhiteSpace(json))
        {
            return new List<Invite>();
        }

        try
        {
            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                Converters = { new JsonStringEnumConverter() }
            };

            var data = JsonSerializer.Deserialize<List<Invite>>(json, options);

            // Normalizar: si no tienen ExpiresAt, dejar default (no expiran)
            return data ?? new List<Invite>();
        }
        catch
        {
            return new List<Invite>();
        }
    }

    private void SaveToFile()
    {
        var options = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new JsonStringEnumConverter() }
        };

        var json = JsonSerializer.Serialize(_invites, options);
        File.WriteAllText(_filePath, json, Encoding.UTF8);
    }
}
*/
public class DbInviteRepository : IInviteRepository
{
    private readonly string _connectionString;

    public DbInviteRepository(string connectionString)
    {
        _connectionString = connectionString;
    }

    private NpgsqlConnection GetConnection() => new(_connectionString);

    public IEnumerable<Invite> GetAll()
    {
        using var conn = GetConnection();
        const string sql = @"
            SELECT
                id,
                name,
                phone,
                token,
                status,
                expires_at AS ""ExpiresAt""
            FROM invites
            ORDER BY created_at NULLS LAST, id";
        // Si no tienes created_at, quita esa parte del ORDER BY
        return conn.Query<Invite>(sql).ToList();
    }

    public Invite? GetById(Guid id)
    {
        using var conn = GetConnection();
        const string sql = @"
            SELECT id, name, phone, token, status, expires_at AS ""ExpiresAt""
            FROM invites
            WHERE id = @id";
        return conn.QuerySingleOrDefault<Invite>(sql, new { id });
    }

    public Invite? GetByToken(string token)
    {
        using var conn = GetConnection();
        const string sql = @"
            SELECT id, name, phone, token, status, expires_at AS ""ExpiresAt""
            FROM invites
            WHERE token = @token";
        return conn.QuerySingleOrDefault<Invite>(sql, new { token });
    }

    public DateTime? GetGlobalExpiration()
    {
        using var conn = GetConnection();
        const string sql = @"SELECT MAX(expires_at) FROM invites";
        return conn.ExecuteScalar<DateTime?>(sql);
    }

    public void SetGlobalExpiration(DateTime expiresAtUtc)
    {
        using var conn = GetConnection();
        const string sql = @"UPDATE invites SET expires_at = @expiresAtUtc";
        conn.Execute(sql, new { expiresAtUtc });
    }

    public Invite Add(string name, string phone)
    {
        var global = GetGlobalExpiration();
        var expiresAt = global ?? DateTime.UtcNow.AddDays(7);

        var invite = new Invite
        {
            Id = Guid.NewGuid(),
            Name = name,
            Phone = phone,
            Token = Guid.NewGuid().ToString("N")[..10],
            Status = InviteStatus.Pending,
            ExpiresAt = expiresAt
        };

        using var conn = GetConnection();
        const string sql = @"
            INSERT INTO invites (id, name, phone, token, status, expires_at)
            VALUES (@Id, @Name, @Phone, @Token, @Status, @ExpiresAt)";
        conn.Execute(sql, invite);

        return invite;
    }

    public Invite? Update(Guid id, string? name, string? phone, InviteStatus? status)
    {
        var invite = GetById(id);
        if (invite is null) return null;

        if (!string.IsNullOrWhiteSpace(name)) invite.Name = name;
        if (!string.IsNullOrWhiteSpace(phone)) invite.Phone = phone;
        if (status.HasValue) invite.Status = status.Value;

        using var conn = GetConnection();
        const string sql = @"
            UPDATE invites
            SET name = @Name,
                phone = @Phone,
                status = @Status
            WHERE id = @Id";
        conn.Execute(sql, invite);

        return invite;
    }

    public bool Remove(Guid id)
    {
        using var conn = GetConnection();
        const string sql = @"DELETE FROM invites WHERE id = @id";
        var rows = conn.Execute(sql, new { id });
        return rows > 0;
    }
}

// =======================
//     INVITES DTOs
// =======================

public record CreateInviteRequest(string Name, string Phone);
// DTO para actualizar evento
public record UpdateEventRequest(
    string? Title,
    string? Subtitle,
    string? Description,
    string? Location,
    string? DateText,
    string? ImageUrl
);

public record UpdateInviteRequest(
    string? Name,
    string? Phone,
    string? Status
);

public record RespondInviteRequest(string Status);

public record InviteResponse(
    Guid Id,
    string Name,
    string Phone,
    string Token,
    string Status,
    DateTime ExpiresAt
);

public record InviteExpirationRequest(DateTime ExpiresAt);

public static class InviteMappings
{
    public static InviteResponse ToResponse(this Invite i) =>
        new(
            i.Id,
            i.Name,
            i.Phone,
            i.Token,
            i.Status.ToString().ToLowerInvariant(),
            i.ExpiresAt
        );

    public static InviteStatus? ParseStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return null;

        return status.ToLowerInvariant() switch
        {
            "pending" => InviteStatus.Pending,
            "confirmed" => InviteStatus.Confirmed,
            "rejected" => InviteStatus.Rejected,
            _ => null
        };
    }
}

// =======================
//  SETTINGS EVENT DOMAIN
// =======================
// >>> NUEVO

public class EventSettings
{
    public string? Title { get; set; }
    public string? Subtitle { get; set; }
    public string? Description { get; set; }
    public string? Location { get; set; }
    public string? DateText { get; set; }
    public string? ImageUrl { get; set; }
}

public interface ISettingsRepository
{
    EventSettings? GetEvent();
    void SaveEvent(EventSettings settings);
}

/*
public class FileSettingsRepository : ISettingsRepository
{
    private readonly string _filePath;
    private readonly object _lock = new();
    private EventSettings _eventSettings;

    public FileSettingsRepository(string filePath)
    {
        _filePath = filePath;
        _eventSettings = LoadFromFile();
    }

    public EventSettings? GetEvent()
    {
        lock (_lock)
        {
            return _eventSettings;
        }
    }

    public void SaveEvent(EventSettings settings)
    {
        lock (_lock)
        {
            _eventSettings = settings;
            SaveToFile();
        }
    }

    private EventSettings LoadFromFile()
    {
        if (!File.Exists(_filePath))
        {
            return new EventSettings();
        }

        var json = File.ReadAllText(_filePath);
        if (string.IsNullOrWhiteSpace(json))
        {
            return new EventSettings();
        }

        try
        {
            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            var data = JsonSerializer.Deserialize<EventSettings>(json, options);
            return data ?? new EventSettings();
        }
        catch
        {
            return new EventSettings();
        }
    }

    private void SaveToFile()
    {
        var options = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        var json = JsonSerializer.Serialize(_eventSettings, options);
        File.WriteAllText(_filePath, json, Encoding.UTF8);
    }
}
*/
public class DbSettingsRepository : ISettingsRepository
{
    private readonly string _connectionString;

    public DbSettingsRepository(string connectionString)
    {
        _connectionString = connectionString;
    }

    private NpgsqlConnection GetConnection() => new(_connectionString);

    public EventSettings? GetEvent()
    {
        using var conn = GetConnection();
        const string sql = @"
            SELECT
                title,
                subtitle,
                description,
                location,
                date_text   AS ""DateText"",
                image_url   AS ""ImageUrl""
            FROM event_settings
            WHERE id = 1";
        return conn.QuerySingleOrDefault<EventSettings>(sql) ?? new EventSettings();
    }

    public void SaveEvent(EventSettings settings)
    {
        using var conn = GetConnection();
        const string sql = @"
            INSERT INTO event_settings (id, title, subtitle, description, location, date_text, image_url)
            VALUES (1, @Title, @Subtitle, @Description, @Location, @DateText, @ImageUrl)
            ON CONFLICT (id) DO UPDATE
            SET title       = EXCLUDED.title,
                subtitle    = EXCLUDED.subtitle,
                description = EXCLUDED.description,
                location    = EXCLUDED.location,
                date_text   = EXCLUDED.date_text,
                image_url   = EXCLUDED.image_url;";
        conn.Execute(sql, settings);
    }
}

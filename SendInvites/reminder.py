import csv
import time
import os
import sys
from dataclasses import dataclass
from typing import List
from urllib.parse import quote

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

# espera entre mensajes para no quemar WhatsApp (ajusta si quieres)
SLEEP_SECONDS = 5

MESSAGE_TEMPLATE = (
    "¡Hola {name}! 💍\n\n"
    "Este es un recordatorio de nuestro evento. Por favor confirma tu asistencia en la página:\n{invite_link}\n\n"
    "Tienes hasta el 20/12/2025 para poder reservar tu asiento. ¡Esperamos verte! 🤍"
)


@dataclass
class Invite:
    id: str
    name: str
    phone: str
    token: str
    status: str
    invite_link: str


def find_csv_file() -> str:
    """
    Busca un archivo .csv en la misma carpeta donde está el .py o el .exe.
    - Si hay varios, intenta priorizar 'invites.csv'.
    - Si no hay ninguno, lanza FileNotFoundError.
    """
    # Carpeta donde está el script o el .exe
    base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))

    # Lista de archivos .csv en esa carpeta
    candidates = [
        f for f in os.listdir(base_dir)
        if f.lower().endswith(".csv")
    ]

    if not candidates:
        raise FileNotFoundError("No se encontró ningún archivo .csv en la carpeta.")

    # Si existe invites.csv, lo usamos preferentemente
    for name in candidates:
        if name.lower() == "invites.csv":
            return os.path.join(base_dir, name)

    # Si no existe invites.csv, usamos el primero de la lista
    return os.path.join(base_dir, candidates[0])


def load_invites(path: str) -> List[Invite]:
    invites: List[Invite] = []

    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            invites.append(
                Invite(
                    id=row["id"],
                    name=row["name"],
                    phone=row["phone"],
                    token=row["token"],
                    status=row["status"],
                    invite_link=row["invite_link"],
                )
            )
    return invites


def filter_pending(invites: List[Invite]) -> List[Invite]:
    return [i for i in invites if i.status.strip().lower() == "pending"]


def normalize_phone_for_whatsapp(phone: str) -> str:
    """
    WhatsApp Web espera solo dígitos, incluyendo código de país.
    Ej: +50433655484 -> 50433655484
    """
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits


def main():
    print("=== Envío automático de invitaciones por WhatsApp Web ===")

    # 1. Encontrar y cargar CSV
    try:
        csv_path = find_csv_file()
        print(f"Usando archivo CSV: {csv_path}")
        invites = load_invites(csv_path)
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        input("Presiona ENTER para salir...")
        return
    except KeyError as e:
        print(f"ERROR: El CSV no tiene la columna esperada: {e}")
        input("Presiona ENTER para salir...")
        return

    pending = filter_pending(invites)

    print(f"Total registros en CSV: {len(invites)}")
    print(f"Invitaciones PENDING: {len(pending)}")

    if not pending:
        print("No hay invitaciones con estado 'pending'.")
        input("Presiona ENTER para salir...")
        return

    # 2. Iniciar navegador (Chrome por defecto)
    print("Abriendo WhatsApp Web...")
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    # Si quieres usar tu perfil de Chrome:
    # options.add_argument(r"--user-data-dir=C:\Users\TU_USUARIO\AppData\Local\Google\Chrome\User Data")

    driver = webdriver.Chrome(options=options)
    driver.get("https://web.whatsapp.com")

    print("Escanea el código QR de WhatsApp Web si es necesario.")
    input("Cuando veas tus chats cargados, presiona ENTER para continuar...")

    enviados = 0
    errores = 0

    for inv in pending:
        try:
            phone_digits = normalize_phone_for_whatsapp(inv.phone)
            if not phone_digits:
                print(f"[SKIP] Teléfono inválido para {inv.name}: {inv.phone}")
                errores += 1
                continue

            msg = MESSAGE_TEMPLATE.format(
                name=inv.name,
                invite_link=inv.invite_link,
            )

            encoded_msg = quote(msg)
            url = (
                f"https://web.whatsapp.com/send?"
                f"phone={phone_digits}&text={encoded_msg}&type=phone_number&app_absent=0"
            )

            print(f"\nEnviando a {inv.name} ({inv.phone})...")
            driver.get(url)

            try:
                # Esperar a que aparezca el cuadro de mensaje
                msg_box = WebDriverWait(driver, 30).until(
                    EC.presence_of_element_located(
                        (By.XPATH, "//div[@contenteditable='true' and @data-tab='10']")
                    )
                )

                time.sleep(2)  # pequeña pausa

                # El texto ya está en el box (por la URL), solo mandamos ENTER
                msg_box.send_keys(Keys.ENTER)

                print(" -> Mensaje enviado.")
                enviados += 1

            except TimeoutException:
                print(" !! No se encontró el cuadro de mensaje a tiempo (timeout).")
                errores += 1

            time.sleep(SLEEP_SECONDS)

        except Exception as e:
            print(f" !! Error inesperado con {inv.name}: {e}")
            errores += 1

    print("\n=== RESUMEN ===")
    print(f"Enviados correctamente: {enviados}")
    print(f"Errores: {errores}")

    input("Proceso terminado. Presiona ENTER para cerrar...")
    driver.quit()


if __name__ == "__main__":
    main()

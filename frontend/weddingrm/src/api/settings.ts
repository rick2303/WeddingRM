export async function getInviteValidity() {
  const res = await fetch("http://localhost:5199/api/settings/invite-validity", {
    credentials: "include",
  });
  return res.json();
}

export async function setInviteValidity(days: number) {
  const res = await fetch("http://localhost:5199/api/settings/invite-validity", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ days }),
  });

  return res.json();
}

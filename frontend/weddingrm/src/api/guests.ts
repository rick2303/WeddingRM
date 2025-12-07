// api/guests.ts
export const sendEmail = async (email: string, link: string) => {
  console.log("EMAIL ENVIADO A:", email, "LINK:", link);
  return true;
};

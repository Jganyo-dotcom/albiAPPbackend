import bcrypt from "bcrypt";

export const harsh = async (password) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
};

export const checkPasswordAuth = async (plainPassword, hashedPassword) => {
  // bcrypt.compare ALWAYS needs the plain text first and the hash second
  const isCorrect = await bcrypt.compare(plainPassword, hashedPassword);
  return isCorrect;
};

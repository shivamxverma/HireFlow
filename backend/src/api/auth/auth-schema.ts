import * as yup from "yup";

export const registerSchema = yup.object({
  email: yup.string().email("Invalid email format").required("Email is required"),
  password: yup.string().min(6, "Password must be at least 6 characters").required("Password is required"),
  username: yup.string().required("Username is required"),
  displayName: yup.string().optional(),
});

export const loginSchema = yup.object({
  email: yup.string().required("Email or username is required"),
  password: yup.string().required("Password is required"),
});

import dotenv from "dotenv";
import * as yup from "yup";

dotenv.config();

const configSchema = yup.object({
  PORT: yup.number().default(3000),
  NODE_ENV: yup.string().oneOf(["development", "production", "test"]).default("development"),
  DATABASE_URL: yup.string().required("DATABASE_URL is required"),
});

const validatedEnv = configSchema.validateSync(process.env, {
  abortEarly: false,
  stripUnknown: true,
});

const env = {
  PORT: validatedEnv.PORT,
  NODE_ENV: validatedEnv.NODE_ENV,
  DATABASE_URL: validatedEnv.DATABASE_URL,
};

export default env;

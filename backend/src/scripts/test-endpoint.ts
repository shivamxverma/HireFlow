import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const endpoint = "https://raghvendrasinghdhakar2--resource.services.ai.azure.com/openai/v1";
const deploymentName = "gpt-5.4";
const apiKey = process.env.AZURE_OPENAI_API_KEY || "3oxSFeNj0GluFk9qObTSk04D943F0GSaGUxQIrVwzhdWAb2FIKRVJQQJ99CDACHYHv6XJ3w3AAAAACOGHxI4";

const openai = new OpenAI({
    baseURL: endpoint,
    apiKey: apiKey
});

async function main() {
  try {
    console.log("=== Testing json_object format ===");
    const runner1 = openai.responses.stream({
      model: deploymentName,
      input: [
        { role: "system", content: "You are a helpful assistant. You must output a JSON object with a key 'answer'." },
        { role: "user", content: "What is 2+2?" }
      ],
      text: {
        format: { type: "json_object" }
      }
    });
    const result1 = await runner1.finalResponse();
    const firstOutput1 = result1.output?.[0] as any;
    console.log("json_object result:", firstOutput1?.content?.[0]?.text);

    console.log("=== Testing json_schema format ===");
    const runner2 = openai.responses.stream({
      model: deploymentName,
      input: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "What is 2+2?" }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "math_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              answer: { type: "string" },
              explanation: { type: "string" }
            },
            required: ["answer", "explanation"],
            additionalProperties: false
          }
        }
      }
    });
    const result2 = await runner2.finalResponse();
    const firstOutput2 = result2.output?.[0] as any;
    console.log("json_schema result:", firstOutput2?.content?.[0]?.text);
  } catch (error) {
    console.error("JSON formatting test failed:", error);
  }
}

main();

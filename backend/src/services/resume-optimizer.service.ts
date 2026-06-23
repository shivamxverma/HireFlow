import OpenAI from "openai";

export interface TailoredResumeData {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    website?: string;
    location?: string;
    github?: string;
    linkedin?: string;
  };
  summary: string;
  skills: {
    category: string; // e.g. "Languages", "Frameworks & Libraries", "Tools"
    items: string[];
  }[];
  experience: {
    company: string;
    role: string;
    location: string;
    duration: string; // e.g. "June 2024 - Present" or "Oct 2023 - May 2024"
    achievements: string[];
  }[];
  projects: {
    name: string;
    description: string; // short summary
    technologies: string[];
    duration?: string;
    bullets: string[];
  }[];
  education: {
    institution: string;
    degree: string;
    location: string;
    duration: string;
    details?: string;
  }[];
}

export class ResumeOptimizerService {
  private openai: OpenAI | null = null;
  private modelName: string;

  constructor() {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "https://raghvendrasinghdhakar2--resource.services.ai.azure.com/openai/v1";
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5.4";
    const apiKey = process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "3oxSFeNj0GluFk9qObTSk04D943F0GSaGUxQIrVwzhdWAb2FIKRVJQQJ99CDACHYHv6XJ3w3AAAAACOGHxI4";

    this.modelName = deploymentName;

    console.log(`[Resume Optimizer] Initializing OpenAI Client in Azure Responses Mode...`);
    console.log(`[Resume Optimizer] Endpoint: ${endpoint}`);
    console.log(`[Resume Optimizer] Deployment: ${deploymentName}`);

    this.openai = new OpenAI({
      baseURL: endpoint,
      apiKey: apiKey,
    });
  }

  /**
   * Tailors a master resume to match a specific job description.
   * Adheres strictly to constraints against hallucinating experience, achievements, or credentials.
   */
  async optimize(
    masterResumeText: string,
    jobTitle: string,
    companyName: string,
    jobDescription: string
  ): Promise<TailoredResumeData> {
    if (!this.openai) {
      throw new Error("OpenAI API client is not initialized.");
    }

    console.log(`[Resume Optimizer] Starting LLM optimization for role: "${jobTitle}" at "${companyName}"...`);

    const systemPrompt = `You are a professional resume writer and career coach specializing in ATS optimization.
Your task is to take a master resume (provided as text) and tailor it for a specific job opening: "${jobTitle}" at "${companyName}".

OBJECTIVE:
Tailor the skills, professional summary, experience bullets, and project descriptions to highlight relevant experience, reorder skills, improve wording, and insert job-specific keywords found in the job description.

CRITICAL CONSTRAINTS (VIOLATIONS ARE UNACCEPTABLE):
1. NEVER invent any work experience, company names, project names, achievements, or education.
2. NEVER exaggerate or fabricate credentials (e.g. degrees, GPAs, certifications).
3. If the master resume does not mention a specific experience, skill level, or project, do not invent it. You may only highlight, reword, and reorder existing details.
4. Keep the output 100% grounded in the facts presented in the master resume text.

INSTRUCTIONS:
- Tailor the "summary" to directly address the key requirements of the job description using your actual experience.
- Group and order "skills" by placing the technologies, languages, and frameworks most critical to the job description first.
- In "experience" and "projects", re-write and refine the bullet points using strong action verbs. Highlight achievements, tasks, and technologies that align with the job description. Ensure you do not invent any metrics or outcomes that were not in the master resume.
- Maintain the original personal contact information and education from the master resume, but format them cleanly.`;

    const userPrompt = `=== MASTER RESUME TEXT ===
${masterResumeText}

=== TARGET JOB DESCRIPTION ===
Role: ${jobTitle}
Company: ${companyName}
Description:
${jobDescription}`;

    try {
      const runner = this.openai.responses.stream({
        model: this.modelName,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "tailored_resume",
            strict: true,
            schema: {
              type: "object",
              properties: {
                personalInfo: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                    website: { type: "string" },
                    location: { type: "string" },
                    github: { type: "string" },
                    linkedin: { type: "string" }
                  },
                  required: ["name", "email", "phone", "website", "location", "github", "linkedin"],
                  additionalProperties: false
                },
                summary: { type: "string" },
                skills: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      items: {
                        type: "array",
                        items: { type: "string" }
                      }
                    },
                    required: ["category", "items"],
                    additionalProperties: false
                  }
                },
                experience: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      company: { type: "string" },
                      role: { type: "string" },
                      location: { type: "string" },
                      duration: { type: "string" },
                      achievements: {
                        type: "array",
                        items: { type: "string" }
                      }
                    },
                    required: ["company", "role", "location", "duration", "achievements"],
                    additionalProperties: false
                  }
                },
                projects: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      technologies: {
                        type: "array",
                        items: { type: "string" }
                      },
                      duration: { type: "string" },
                      bullets: {
                        type: "array",
                        items: { type: "string" }
                      }
                    },
                    required: ["name", "description", "technologies", "duration", "bullets"],
                    additionalProperties: false
                  }
                },
                education: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      institution: { type: "string" },
                      degree: { type: "string" },
                      location: { type: "string" },
                      duration: { type: "string" },
                      details: { type: "string" }
                    },
                    required: ["institution", "degree", "location", "duration", "details"],
                    additionalProperties: false
                  }
                }
              },
              required: ["personalInfo", "summary", "skills", "experience", "projects", "education"],
              additionalProperties: false
            }
          }
        },
        temperature: 0.1 // Low temperature to maximize adherence to facts and instructions
      });

      const result = await runner.finalResponse();
      const firstOutput = result.output?.[0] as any;
      const contentItem = firstOutput?.content?.find((c: any) => c.type === 'output_text');
      const rawJson = contentItem?.text || "";

      if (!rawJson) {
        throw new Error("Received empty response content from OpenAI Chat Completion.");
      }

      const tailoredData = JSON.parse(rawJson) as TailoredResumeData;
      console.log("[Resume Optimizer] Successfully generated tailored resume details via OpenAI.");
      return tailoredData;
    } catch (error) {
      console.error("[Resume Optimizer] Error optimizing resume via OpenAI:", error);
      throw new Error(`Resume optimization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

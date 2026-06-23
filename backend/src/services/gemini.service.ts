import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { ResumeFetcherService } from "./resume-fetcher.service.js";
// @ts-ignore
import { PDFParse } from "pdf-parse";

export interface GeneratedEmail {
  subject: string;
  body: string;
}

export interface ExtractedJob {
  company: string;
  role: string;
  location: string;
  salary: string;
  experience: string;
  skills: string[];
  job_type: string;
  apply_url: string;
  job_description: string;
}

export class GeminiService {
  private openai: OpenAI | null = null;
  private resumeFetcher: ResumeFetcherService;
  private storageDir: string;
  private modelName: string;

  constructor() {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "https://raghvendrasinghdhakar2--resource.services.ai.azure.com/openai/v1";
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5.4";
    const apiKey = process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "3oxSFeNj0GluFk9qObTSk04D943F0GSaGUxQIrVwzhdWAb2FIKRVJQQJ99CDACHYHv6XJ3w3AAAAACOGHxI4";

    this.resumeFetcher = new ResumeFetcherService();
    this.storageDir = path.resolve(process.cwd(), "storage");
    this.modelName = deploymentName;

    console.log(`[Gemini Service] Initializing OpenAI Client in Azure Responses Mode...`);
    console.log(`[Gemini Service] Endpoint: ${endpoint}`);
    console.log(`[Gemini Service] Deployment: ${deploymentName}`);

    this.openai = new OpenAI({
      baseURL: endpoint,
      apiKey: apiKey,
    });
  }

  /**
   * Helper to execute call with retries and handle potential delays
   */
  private async safeCall(
    input: any,
    options: { format?: any; temperature?: number } = {}
  ): Promise<string> {
    if (!this.openai) {
      throw new Error("OpenAI Client is not initialized.");
    }

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const streamParams: any = {
          model: this.modelName,
          input: input,
        };

        if (options.format) {
          streamParams.text = {
            format: options.format,
          };
        }

        if (options.temperature !== undefined) {
          streamParams.temperature = options.temperature;
        }

        const runner = this.openai.responses.stream(streamParams);
        const result = await runner.finalResponse();
        const firstOutput = result.output?.[0] as any;
        const contentItem = firstOutput?.content?.find((c: any) => c.type === 'output_text');
        return contentItem?.text || "";
      } catch (error: any) {
        attempts++;

        const isRateLimit = 
          error.status === 429 || 
          error.statusCode === 429 || 
          error.name === "RateLimitError" || 
          String(error).includes("429") ||
          (error.message && String(error.message).includes("429"));

        if (isRateLimit && attempts < maxAttempts) {
          console.warn(`[Gemini Service] Rate limit (429) encountered. Sleeping 30 seconds before retry (Attempt ${attempts}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, 30000));
          continue;
        }

        // Re-throw if it's not a rate limit error or we ran out of attempts
        throw error;
      }
    }

    throw new Error("Gemini API call failed after max rate-limit retries.");
  }

  /**
   * Safe parser for extracting JSON content from response messages
   */
  private parseJsonResponse<T>(rawContent: string): T {
    try {
      // 1. Clean up potential markdown code block formatting
      let cleaned = rawContent.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/i, "");
        cleaned = cleaned.replace(/\n?```$/i, "");
      }
      return JSON.parse(cleaned.trim()) as T;
    } catch (error) {
      console.error("[Gemini Service] Failed to parse JSON response. Raw output:", rawContent);
      throw new Error("Failed to parse AI response into structured email fields.");
    }
  }

  /**
   * Ensures that candidate's skills and projects are extracted and stored in `storage/`
   */
  async ensureSkillsAndProjects(): Promise<{ skills: string; projects: string }> {
    const skillsPath = path.join(this.storageDir, "skills.txt");
    const projectsPath = path.join(this.storageDir, "projects.txt");

    let skills = "";
    let projects = "";

    // Load if they already exist
    if (fs.existsSync(skillsPath) && fs.existsSync(projectsPath)) {
      skills = fs.readFileSync(skillsPath, "utf-8");
      projects = fs.readFileSync(projectsPath, "utf-8");
      console.log("[Gemini Service] Loaded skills and projects from storage cache.");
      return { skills, projects };
    }

    console.log("[Gemini Service] Cache missing. Fetching master resume to extract skills and projects...");
    const resumeData = await this.resumeFetcher.fetchMasterResume();

    if (!this.openai) {
      throw new Error("Gemini API is not initialized. Cannot extract resume parameters.");
    }

    // 1. Extract Skills
    console.log("[Gemini Service] Extracting skills from resume...");
    const skillsPrompt = `You are a professional ATS resume parsing assistant.
Analyze the following resume text and extract the candidate's complete technical skills profile (languages, frameworks, libraries, developer tools, databases, methodologies, cloud platforms).
Format them as a clean, bulleted or comma-separated list. Keep it concise.

Candidate Resume Text:
${resumeData.text}`;

    skills = await this.safeCall(
      [{ role: "user", content: skillsPrompt }],
      { temperature: 0.1 }
    );
    fs.writeFileSync(skillsPath, skills.trim(), "utf-8");
    console.log(`[Gemini Service] Saved extracted skills to: ${skillsPath}`);

    // 2. Extract Projects
    console.log("[Gemini Service] Extracting projects from resume...");
    const projectsPrompt = `You are a professional ATS resume parsing assistant.
Analyze the following resume text and extract all major technical projects the candidate built.
Include project names, technologies utilized, and key bullet points describing features or achievements.

Candidate Resume Text:
${resumeData.text}`;

    projects = await this.safeCall(
      [{ role: "user", content: projectsPrompt }],
      { temperature: 0.1 }
    );
    fs.writeFileSync(projectsPath, projects.trim(), "utf-8");
    console.log(`[Gemini Service] Saved extracted projects to: ${projectsPath}`);

    return { skills, projects };
  }

  /**
   * Generates a highly personalized initial cold email
   */
  async generateInitialEmail(
    companyName: string,
    jobDescription: string
  ): Promise<GeneratedEmail> {
    const resumeData = await this.resumeFetcher.fetchMasterResume();
    const { skills, projects } = await this.ensureSkillsAndProjects();

    const systemPrompt = `You are a cold outreach and copywriting expert.
Your goal is to write a highly compelling, professional, personalized cold email to a recruiter at a company.
The email MUST be written in the FIRST PERSON perspective ("I", "my", "me") directly from the candidate Shivam Kumar Verma himself.

STRICT CONSTRAINTS (VIOLATIONS ARE UNACCEPTABLE):
1. Write in the FIRST PERSON as Shivam Kumar Verma. Never write in the third person or say you are writing "on behalf of Shivam". Say "I am a B.Tech CSE student...", "My profile...", "I am eager...".
2. Ground all experience, achievements, and technical credentials strictly in the candidate's Resume, Skills, and Projects. Do NOT hallucinate achievements, degrees, or certifications.
3. Keep the email copy concise, engaging, and clear (around 150-200 words). Avoid long paragraphs. Use spacing.
4. Sign off the email from "Shivam Kumar Verma".
5. The output MUST be a valid JSON object with EXACTLY two fields:
{
  "subject": "...",
  "body": "..."
}
6. Do NOT output any markdown tags outside of the JSON object itself. Ensure it is pure parseable JSON.`;

    const userPrompt = `=== CANDIDATE OUTREACH CONTEXT ===

Candidate Resume Text:
${resumeData.text}

Candidate Key Skills:
${skills}

Candidate Projects:
${projects}

=== TARGET ROLE CONTEXT ===

Target Company Name:
${companyName}

Target Job Description:
${jobDescription}`;

    const rawResponse = await this.safeCall(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        format: { type: "json_object" },
        temperature: 0.2,
      }
    );

    return this.parseJsonResponse<GeneratedEmail>(rawResponse);
  }

  /**
   * Generates a professional manual follow-up email
   */
  async generateFollowUpEmail(
    companyName: string,
    jobDescription: string,
    initialEmail: string,
    previousFollowUps: string[],
    followUpNumber: number
  ): Promise<GeneratedEmail> {
    const resumeData = await this.resumeFetcher.fetchMasterResume();

    const systemPrompt = `You are a cold outreach and copywriting expert.
Write a concise, professional follow-up email to a recruiter regarding a job application at ${companyName}.
The email MUST be written in the FIRST PERSON perspective ("I", "my", "me") directly from the candidate Shivam Kumar Verma himself.

STRICT CONSTRAINTS & RULES (VIOLATIONS ARE UNACCEPTABLE):
1. Write in the FIRST PERSON as Shivam Kumar Verma. Never write in the third person or say you are writing "on behalf of Shivam".
2. Keep it extremely concise and direct. The maximum length is 80 to 120 words.
3. Do NOT repeat the exact content or sentences of the initial email or previous follow-up emails.
4. Check in politely and, if possible, mention additional value or briefly highlight a project/skill that matches the job description.
5. Sign off the email from "Shivam Kumar Verma".
6. Output ONLY a valid JSON object with EXACTLY two fields:
{
  "subject": "...",
  "body": "..."
}
7. Do NOT include markdown styling or text around the JSON object.`;

    const userPrompt = `=== CANDIDATE CONTEXT ===
Resume:
${resumeData.text}

=== TARGET OUTREACH DETAILS ===
Company: ${companyName}
Job Description: ${jobDescription}
Follow-Up Number: ${followUpNumber}

=== EMAIL HISTORY ===
Initial Cold Email Sent:
${initialEmail}

Previous Follow-up Emails:
${previousFollowUps.length > 0 ? previousFollowUps.map((e, i) => `[Follow-up ${i + 1}]:\n${e}`).join("\n\n") : "None"}
`;

    const rawResponse = await this.safeCall(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        format: { type: "json_object" },
        temperature: 0.2,
      }
    );

    return this.parseJsonResponse<GeneratedEmail>(rawResponse);
  }

  /**
   * Extracts lead details (company name, recruiter email, and job description) from an uploaded image of a job posting.
   * @param base64Image The base64-encoded string of the image
   * @param mimeType The MIME type of the image (e.g. image/png, image/jpeg)
   */
  async extractLeadFromImage(
    base64Image: string,
    mimeType: string
  ): Promise<{ companyName: string; recipientEmail: string; jobDescription: string }> {
    const systemPrompt = `You are an expert recruitment assistant.
Analyze the provided image of a job posting, recruitment flyer, or LinkedIn screenshot.
Extract the target lead details as accurately as possible.

STRICT RULES:
1. Extract the "companyName" (e.g. Google, Stripe, etc. - default to "" if absolutely not mentioned).
2. Extract the "recipientEmail" (e.g. recruit@company.com - default to "" if not mentioned, do NOT hallucinate).
3. Extract the full "jobDescription" or requirements (include all visible details of the job role and responsibilities).
4. Output MUST be a valid JSON object with EXACTLY three fields:
{
  "companyName": "...",
  "recipientEmail": "...",
  "jobDescription": "..."
}
5. Do NOT include any markdown or text around the JSON object.`;

    console.log("[Gemini Service] Extracting lead from image using Azure Responses API...");
    const rawResponse = await this.safeCall(
      [
        {
          role: "user",
          content: [
            { type: "input_text", text: `${systemPrompt}\n\nPlease extract the recruiter lead details from this image.` },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${base64Image}`,
            },
          ],
        }
      ],
      {
        format: { type: "json_object" },
        temperature: 0.1,
      }
    );

    return this.parseJsonResponse<{ companyName: string; recipientEmail: string; jobDescription: string }>(rawResponse);
  }

  /**
   * Extracts profile details (name, role, company, companyUrl, linkedinUrl, and notes) from an uploaded file (PDF or image) of a profile or resume.
   * @param base64Data The base64-encoded string of the file
   * @param mimeType The MIME type of the file (e.g. application/pdf, image/png, image/jpeg)
   */
  async extractProfileFromFile(
    base64Data: string,
    mimeType: string
  ): Promise<{ name: string; role: string; company: string; companyUrl: string; linkedinUrl: string; notes: string }> {
    const systemPrompt = `You are an expert recruitment assistant.
Analyze the provided document (which could be a PDF or image of a resume, CV, or LinkedIn profile).
Extract the personal/professional profile details as accurately as possible.

STRICT RULES:
1. Extract the "name" of the person (default to "" if absolutely not found).
2. Extract their primary "role" or headline (e.g. Backend Engineer, Recruiter, Founder - default to "" if not found).
3. Extract their current or most recent "company" (e.g. Stripe, Klimb - default to "" if not found).
4. Extract their "companyUrl" (e.g. https://www.linkedin.com/company/companyname or their company website URL - if mentioned in the document, extract it completely and cleanly. Default to "" if not found).
5. Extract their "linkedinUrl" (e.g. https://www.linkedin.com/in/username - if mentioned in the document, extract it completely and cleanly. Default to "" if not found).
6. Extract a brief summary of top skills, achievements, or experience as "notes" to serve as context for outreach (maximum 3-4 sentences. Default to "" if not found).
7. Output MUST be a valid JSON object with EXACTLY six fields:
{
  "name": "...",
  "role": "...",
  "company": "...",
  "companyUrl": "...",
  "linkedinUrl": "...",
  "notes": "..."
}
8. Do NOT include any markdown or text around the JSON object.`;

    let contentInput: any;

    if (mimeType === "application/pdf") {
      console.log("[Gemini Service] PDF uploaded. Parsing PDF text locally before sending to LLM...");
      const buffer = Buffer.from(base64Data, "base64");
      const pdfParser = new PDFParse({ data: buffer });
      const parsedTextResult = await pdfParser.getText();
      const parsedText = parsedTextResult.text || "";

      if (!parsedText.trim()) {
        throw new Error("Failed to extract text from PDF profile.");
      }

      contentInput = [
        {
          role: "user",
          content: [
            { type: "input_text", text: `${systemPrompt}\n\nPlease extract the profile details from the following resume text:\n\n${parsedText}` }
          ]
        }
      ];
    } else {
      console.log("[Gemini Service] Image uploaded. Extracting profile details using Azure Responses API...");
      contentInput = [
        {
          role: "user",
          content: [
            { type: "input_text", text: `${systemPrompt}\n\nPlease extract the profile details from this document.` },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${base64Data}`,
            },
          ],
        }
      ];
    }

    const rawResponse = await this.safeCall(contentInput, {
      format: { type: "json_object" },
      temperature: 0.1,
    });

    return this.parseJsonResponse<{ name: string; role: string; company: string; companyUrl: string; linkedinUrl: string; notes: string }>(rawResponse);
  }

  /**
   * Dynamic Outreach Message Generator powered by custom templates
   */
  async generateOutreachMessage(
    profile: { name: string; role: string; company: string; notes?: string | null },
    resume: { parsedText: string; skills: string[]; experience?: string | null; projects?: string | null },
    job: { title: string; company: string; description?: string | null } | null,
    templatePrompt: string,
    messageType: string
  ): Promise<GeneratedEmail> {
    const systemPrompt = `You are an expert cold outreach copywriter.
Your goal is to write a highly compelling, personalized networking or referral email.
The message MUST be written in the FIRST PERSON perspective ("I", "my", "me") directly from the candidate Shivam Kumar Verma.

STRICT RULES:
1. Write in the FIRST PERSON as Shivam Kumar Verma. Never write in the third person or say you are writing "on behalf of Shivam".
2. Ground all experience, achievements, and technical credentials strictly in the candidate's Resume. Do NOT hallucinate credentials.
3. Keep the body concise, engaging, and clear (around 100-250 words). Avoid dense blocks of text.
4. Output EXACTLY a valid JSON object with two fields:
{
  "subject": "...",
  "body": "..."
}
5. Do NOT include markdown tags around the JSON object.
6. The outreach message type is: ${messageType}.
7. Follow these base prompt instructions for writing style and target objective:
${templatePrompt}`;

    const userPrompt = `=== CANDIDATE CONTEXT ===
Name: Shivam Kumar Verma
Skills: ${resume.skills.join(", ")}
Experience Summary: ${resume.experience || "Not specified"}
Projects: ${resume.projects || "Not specified"}
Full Resume Text:
${resume.parsedText}

=== TARGET PROFILE CONTEXT ===
Name: ${profile.name}
Role: ${profile.role}
Company: ${profile.company}
Recruiter/Employee Notes: ${profile.notes || "None"}

=== TARGET JOB CONTEXT ===
${job ? `Job Title: ${job.title}
Job Company: ${job.company}
Job Description: ${job.description || "None"}` : "No specific job posting attached."}
`;

    const rawResponse = await this.safeCall(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        format: { type: "json_object" },
        temperature: 0.25,
      }
    );

    return this.parseJsonResponse<GeneratedEmail>(rawResponse);
  }

  /**
   * Extracts structured job information from raw message text using Azure Responses API
   */
  async extractJobFromText(text: string): Promise<ExtractedJob> {
    const systemPrompt = `You are an expert AI recruiting assistant.
Analyze the provided Telegram message and extract job details.
You MUST output a valid JSON object with the exact fields below.
If a field is not found in the text, use an empty string "" (or empty array [] for skills). Do NOT invent information.
If the message is not a job posting at all, return an empty object or set company, role, and apply_url to empty strings.

Required Output Format:
{
  "company": "Company Name",
  "role": "Job Title / Role",
  "location": "Location (e.g. Remote, Bangalore, etc.)",
  "salary": "Salary compensation detail (if mentioned)",
  "experience": "Experience requirements",
  "skills": ["skill1", "skill2"],
  "job_type": "Full-time, Part-time, Internship, Contract, etc.",
  "apply_url": "URL or email to apply",
  "job_description": "A clean summary of the job description and requirements"
}
Do NOT include any markdown tags (like \`\`\`json) outside of the JSON object itself. Return valid JSON only.`;

    const rawResponse = await this.safeCall(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Telegram Message:\n${text}` },
      ],
      {
        format: { type: "json_object" },
        temperature: 0.1,
      }
    );

    return this.parseJsonResponse<ExtractedJob>(rawResponse);
  }
}

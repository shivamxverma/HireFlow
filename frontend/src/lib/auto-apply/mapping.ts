import { FormField } from "./extraction";

// Simplified Profile Type matching our Prisma schema
export interface UserProfileData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  resumeUrl: string; // the path/url to the pdf
}

export interface MappedField {
  field: FormField;
  value?: string;
  requiresAi: boolean;
}

export function mapFieldsToProfile(fields: FormField[], profile: UserProfileData): MappedField[] {
  const mapped: MappedField[] = [];

  for (const field of fields) {
    const labelLower = field.label.toLowerCase();
    
    let value = '';
    let requiresAi = false;

    if (labelLower.includes('first name') || labelLower.includes('last name') || labelLower.includes('full name') || labelLower.includes('name')) {
      value = profile.fullName;
    } else if (labelLower.includes('email')) {
      value = profile.email;
    } else if (labelLower.includes('phone') || labelLower.includes('mobile')) {
      value = profile.phone;
    } else if (labelLower.includes('location') || labelLower.includes('city') || labelLower.includes('address')) {
      value = profile.location;
    } else if (labelLower.includes('linkedin')) {
      value = profile.linkedinUrl;
    } else if (labelLower.includes('github')) {
      value = profile.githubUrl;
    } else if (labelLower.includes('portfolio') || labelLower.includes('website')) {
      value = profile.portfolioUrl;
    } else if (field.type === 'file' || labelLower.includes('resume') || labelLower.includes('cv')) {
      value = profile.resumeUrl; 
    } else {
      // If it's a generic text area or text input that we don't recognize, use AI
      // Or if it's a specific question
      if (field.type === 'textarea' || labelLower.includes('why') || labelLower.includes('describe') || labelLower.length > 30) {
         requiresAi = true;
      }
    }

    mapped.push({
      field,
      value,
      requiresAi
    });
  }

  return mapped;
}

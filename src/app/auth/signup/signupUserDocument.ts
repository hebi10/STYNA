export interface SignupUserDocumentInput {
  email: string;
  name: string;
  phone: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  gender: string;
  termsAgree: boolean;
  privacyAgree: boolean;
  marketingAgree: boolean;
}

export function buildSignupUserDocument(
  uid: string,
  formData: SignupUserDocumentInput,
  timestamp: unknown
): Record<string, unknown> {
  return {
    id: uid,
    email: formData.email,
    name: formData.name,
    phone: formData.phone,
    birth: {
      year: formData.birthYear,
      month: formData.birthMonth,
      day: formData.birthDay,
    },
    gender: formData.gender,
    termsAgree: formData.termsAgree,
    privacyAgree: formData.privacyAgree,
    marketingAgree: formData.marketingAgree,
    status: "active",
    role: "user",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

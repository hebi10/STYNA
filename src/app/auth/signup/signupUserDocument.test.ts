import { buildSignupUserDocument } from "./signupUserDocument";

describe("buildSignupUserDocument", () => {
  test("returns the profile fields with safe access defaults and matching timestamps", () => {
    const timestamp = { type: "server-timestamp" };
    const formData = {
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123",
      name: "테스트 사용자",
      phone: "010-1234-5678",
      birthYear: "1990",
      birthMonth: "7",
      birthDay: "20",
      gender: "female",
      termsAgree: true,
      privacyAgree: true,
      marketingAgree: false,
    };

    expect(buildSignupUserDocument("user-1", formData, timestamp)).toEqual({
      id: "user-1",
      email: "user@example.com",
      name: "테스트 사용자",
      phone: "010-1234-5678",
      birth: {
        year: "1990",
        month: "7",
        day: "20",
      },
      gender: "female",
      termsAgree: true,
      privacyAgree: true,
      marketingAgree: false,
      status: "active",
      role: "user",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });
});

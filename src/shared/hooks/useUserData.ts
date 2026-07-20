import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/shared/libs/firebase/firebase";

export const USER_DATA_NOT_FOUND_ERROR_CODE = "USER_DATA_NOT_FOUND";

export class UserDataNotFoundError extends Error {
  readonly code = USER_DATA_NOT_FOUND_ERROR_CODE;

  constructor() {
    super("User not found");
    this.name = "UserDataNotFoundError";
  }
}

export function isUserDataNotFoundError(error: unknown): error is UserDataNotFoundError {
  return error instanceof UserDataNotFoundError
    || (
      typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === USER_DATA_NOT_FOUND_ERROR_CODE
    );
}

async function fetchUserData(uid: string | null) {
  if (!uid) throw new Error("uid is required");
  const docRef = doc(db, "users", uid); 
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new UserDataNotFoundError();
  return snap.data();
}

// 쿼리 훅도 동일하게 string | null 타입
export function useUserData(uid: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["user", uid],
    queryFn: () => fetchUserData(uid),
    enabled: !!uid,
  });
  return { data, isLoading, error };
}

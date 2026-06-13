export type ApiErrorBody = {
  code: string;
  message: string;
};

export function errorBody(code: string, message: string): ApiErrorBody {
  return { code, message };
}

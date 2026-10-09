/**
 * Where a finished story run returns to, based on how it was entered.
 * First run (/story) continues to setup; "Watch again" (/app/story) returns to the app.
 */
export function storyDoneTarget(pathname: string): string {
  return pathname.startsWith("/app") ? "/app" : "/setup";
}

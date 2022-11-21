import { UserData } from "./user";
interface Context {
    user: UserData | null;
}
declare global {
    namespace Express {
        interface Request {
            context: Context;
        }
    }
}
export {};

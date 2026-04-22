export interface LoginRequest {
    email : string;
    password : string;
    rememberMe : boolean;
}

export interface AuthResponse {
    accessToken : string;
    refreshToken?: string;
    email : string;
    firstName : string;
    lastName : string;
    role : string;
}
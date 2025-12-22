export interface ApiRequest {
    id: string;
    label: string;
    method: string;
    url: string;
    headers: string; // Stored as JSON string
    body: string;    // Stored as JSON string
}
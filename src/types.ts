export type ApiItem = ApiRequest | ApiFolder;

export interface ApiFolder {
    id: string;
    type: 'folder';
    label: string;
    children: ApiItem[];
}

export interface ApiRequest {
    id: string;
    type: 'request';
    label: string;
    method: string;
    url: string;
    headers: string;
    body: string;
}
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const port = Number(process.env.PORT ?? 3001);
app.use(express_1.default.json());
app.get('/health', (_request, response) => {
    response.json({ ok: true, service: 'manlab-backend' });
});
app.get('/', (_request, response) => {
    response.json({ ok: true, message: 'ManLab backend running' });
});
app.listen(port, () => {
    console.log(`ManLab backend listening on http://localhost:${port}`);
});


import { GoogleGenAI, Type } from "@google/genai";
import { TableSchema, UserRole, AIResponse } from "../types";

export class GeminiSQLService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateSQL(prompt: string, schema: TableSchema[], role: UserRole): Promise<AIResponse> {
    const schemaContext = schema.map(table => {
      const cols = table.columns.map(c => `${c.name} (${c.type}): ${c.description}`).join(', ');
      return `Table: ${table.tableName}\nColumns: ${cols}`;
    }).join('\n\n');

    const systemInstruction = `
      You are a specialized SQL Generator for an Oracle enterprise database.
      
      DATABASE SCHEMA:
      ${schemaContext}

      RULES:
      1. Output MUST be valid Oracle SQL syntax.
      2. ${role === UserRole.ADMIN ? 'You may generate DDL (CREATE, DROP, ALTER) if requested.' : 'ONLY generate SELECT queries.'}
      3. Use the schema provided. Do not invent tables or columns.
      4. If you cannot answer, explain why in the explanation field.
      5. The current user has the role: ${role}.
      6. Return ONLY a JSON object matching the requested schema.
      7. Use Oracle-specific syntax (e.g., ROWNUM instead of LIMIT, DUAL for dummy table, NVL instead of IFNULL).
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sql: { type: Type.STRING, description: 'The generated SQL query' },
              explanation: { type: Type.STRING, description: 'Briefly explain what this query does' },
              tablesUsed: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of tables referenced in the query'
              }
            },
            required: ['sql', 'explanation', 'tablesUsed']
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      if (!result.sql) result.sql = ''; // Safety fallback
      return result;
    } catch (error) {
      console.error("Gemini SQL Generation Error:", error);
      throw new Error("Failed to translate natural language to SQL.");
    }
  }
}

export const geminiService = new GeminiSQLService();

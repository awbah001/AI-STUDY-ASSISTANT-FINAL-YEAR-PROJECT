import { describe, it, expect } from "vitest";
import { invokeLLM } from "./_core/llm";

describe.skip("Gemini API Integration", () => {
  it("should successfully call Gemini API with valid credentials", async () => {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant. Respond with a single word.",
        },
        {
          role: "user",
          content: "Say hello",
        },
      ],
    });

    expect(response).toBeDefined();
    expect(response.choices).toBeDefined();
    expect(response.choices.length).toBeGreaterThan(0);
    expect(response.choices[0]?.message).toBeDefined();
    expect(response.choices[0]?.message.content).toBeDefined();
    expect(typeof response.choices[0]?.message.content).toBe("string");
  });

  it("should handle structured JSON responses", async () => {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant designed to output JSON. Extract key information.",
        },
        {
          role: "user",
          content: "Extract the topic and difficulty from: Advanced Python Programming",
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "content_info",
          strict: true,
          schema: {
            type: "object",
            properties: {
              topic: { type: "string", description: "The main topic" },
              difficulty: {
                type: "string",
                enum: ["beginner", "intermediate", "advanced"],
                description: "The difficulty level",
              },
            },
            required: ["topic", "difficulty"],
            additionalProperties: false,
          },
        },
      },
    });

    expect(response).toBeDefined();
    expect(response.choices).toBeDefined();
    expect(response.choices.length).toBeGreaterThan(0);

    const content = response.choices[0]?.message.content;
    expect(content).toBeDefined();

    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      expect(parsed).toHaveProperty("topic");
      expect(parsed).toHaveProperty("difficulty");
    }
  });
});

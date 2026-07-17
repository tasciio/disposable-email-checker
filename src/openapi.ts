export const OPENAPI_DOCUMENT = {
  openapi: "3.1.0",
  info: {
    title: "Disposable Email Checker API",
    version: "1.0.0",
    description:
      "Checks whether an email domain or domain appears in the deployed disposable-domain blacklist. This service does not verify mailboxes or DNS records.",
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "The Worker is ready.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: { status: { const: "ok" } },
                },
              },
            },
          },
        },
      },
    },
    "/v1/check": {
      get: {
        summary: "Check an email address or domain",
        parameters: [
          {
            name: "email",
            in: "query",
            description: "Provide exactly one of email or domain.",
            schema: { type: "string", maxLength: 254 },
          },
          {
            name: "domain",
            in: "query",
            description: "Provide exactly one of email or domain.",
            schema: { type: "string", maxLength: 253 },
          },
        ],
        responses: {
          "200": { $ref: "#/components/responses/CheckResult" },
          "400": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
          "503": { $ref: "#/components/responses/Error" },
        },
      },
      post: {
        summary: "Check an email address or domain using JSON",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["email"],
                    properties: { email: { type: "string", maxLength: 254 } },
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["domain"],
                    properties: { domain: { type: "string", maxLength: 253 } },
                  },
                ],
              },
            },
          },
        },
        responses: {
          "200": { $ref: "#/components/responses/CheckResult" },
          "400": { $ref: "#/components/responses/Error" },
          "413": { $ref: "#/components/responses/Error" },
          "415": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
          "503": { $ref: "#/components/responses/Error" },
        },
      },
    },
  },
  components: {
    schemas: {
      CheckResult: {
        type: "object",
        additionalProperties: false,
        required: ["domain", "disposable", "matchedDomain"],
        properties: {
          domain: { type: "string" },
          disposable: { type: "boolean" },
          matchedDomain: { type: ["string", "null"] },
        },
      },
      Error: {
        type: "object",
        additionalProperties: false,
        required: ["error"],
        properties: {
          error: {
            type: "object",
            additionalProperties: false,
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      CheckResult: {
        description: "The normalized domain and its blacklist status.",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/CheckResult" } },
        },
      },
      Error: {
        description: "An API error.",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error" } },
        },
      },
    },
  },
} as const;

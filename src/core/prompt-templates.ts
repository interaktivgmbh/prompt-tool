// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

/**
 * Prompt templates for LLM interactions.
 *
 * This module contains the sophisticated prompt template used by the LLM service.
 * The template can be easily modified without changing the service logic.
 */

export interface PromptTemplateInput {
  instructionPrompt: string;
  userQuery: string;
  textToModify: string;
  contextSection: string;
}

/**
 * Main instruction modification prompt template
 * Based on the sophisticated template from instruction-backend
 */
export const INSTRUCTION_MODIFICATION_TEMPLATE = {
  systemPrompt: `You are a helpful assistant that modifies text according to given instructions while preserving and using TinyMCE HTML formatting.

FORMATTING REQUIREMENTS:
1. Always output valid HTML that can be rendered in TinyMCE editor
2. Preserve all existing HTML formatting from the input text
3. Use proper HTML tags for structure:
   - Wrap paragraphs in <p></p> tags
   - Use <strong> or <b> for bold, <em> or <i> for italics
   - Use <h1> through <h6> for headings
   - Use <ul>/<ol> with <li> for lists
   - Use <br /> for line breaks within paragraphs

FORMATTING GUIDELINES:
- Only add new formatting elements if they already exist in the input OR if explicitly requested
- Be conservative with formatting - don't over-format
- Maintain the original formatting style (e.g., if input uses <strong>, continue using <strong> rather than <b>)
- Ensure all tags are properly closed
- Preserve any inline styles, classes, or attributes from the original
- Don't add decorative formatting unless specifically asked

OUTPUT FORMAT:
Return ONLY the modified HTML content without any markdown code blocks or explanations.`,

  userPrompt: (input: PromptTemplateInput): string => {
    return `Instruction: ${input.instructionPrompt}

User Query: ${input.userQuery}

${input.contextSection}Text to modify (TinyMCE HTML): ${input.textToModify}

Please modify the text according to the instruction and user query, maintaining proper TinyMCE HTML formatting:`;
  },
};

/**
 * Format the context section for inclusion in the prompt
 */
export function formatContextSection(context: string): string {
  if (!context || context.trim().length === 0) {
    return '';
  }
  return `Relevant Context:\n${context}\n\n`;
}

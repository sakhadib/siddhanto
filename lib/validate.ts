import { z } from "zod";

// Limits — mirrored in the UI, enforced authoritatively on the server.
export const LIMITS = {
  stateMax: 1200,
  instructionsMax: 512,
  questionsMax: 10,
  choiceOptionsMin: 2,
  choiceOptionsMax: 255,
  scoreLevelsMin: 2,
  scoreLevelsMax: 10,
} as const;

const noulCriteria = z
  .object({
    true: z.string().max(300).optional(),
    false: z.string().max(300).optional(),
  })
  .optional();

const choiceCriteria = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(100),
      description: z.string().trim().max(500).optional(),
    })
  )
  .min(LIMITS.choiceOptionsMin)
  .max(LIMITS.choiceOptionsMax);

const scoreCriteria = z
  .array(z.string().trim().min(1).max(300))
  .min(LIMITS.scoreLevelsMin)
  .max(LIMITS.scoreLevelsMax);

const instructions = z.string().trim().min(1).max(LIMITS.instructionsMax);

export const questionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("noul"), instructions, criteria: noulCriteria }),
  z.object({ type: z.literal("choice"), instructions, criteria: choiceCriteria }),
  z.object({ type: z.literal("score"), instructions, criteria: scoreCriteria }),
]);

export const decideRequestSchema = z.object({
  state: z.string().trim().min(1).max(LIMITS.stateMax),
  questions: z.array(questionSchema).min(1).max(LIMITS.questionsMax),
  meta: z.object({
    timeOnFormMs: z.number().min(0),
    honeypot: z.string().max(200),
  }),
});

export type NoulCriteria = z.infer<typeof noulCriteria>;
export type ChoiceCriteria = z.infer<typeof choiceCriteria>;
export type ScoreCriteria = z.infer<typeof scoreCriteria>;
export type Question = z.infer<typeof questionSchema>;
export type DecideRequest = z.infer<typeof decideRequestSchema>;

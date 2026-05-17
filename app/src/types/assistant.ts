export type AssistantRole = 'user' | 'assistant'

export interface AssistantMessage {
  role: AssistantRole
  content: string
  createdAt?: string
}

export type AssistantAttachment =
  | { type: 'youtube'; url: string }
  | { type: 'file'; fileName: string; fileText: string; truncated?: boolean }

export const ASSISTANT_QUICK_ACTIONS = [
  { id: 'apply', label: 'Auf meine Brand anwenden', prompt: 'Wende diesen Inhalt konkret auf meine Brand an. Was bedeutet das für unsere Positioning und ICPs? Nenne drei konkrete Maßnahmen — spezifisch für diese Brand, nicht generisch.' },
  { id: 'content', label: '3 Content-Ideen daraus', prompt: 'Leite daraus drei konkrete Content-Ideen ab, die zu unserer Brand-DNA, unseren ICPs und unserem Tone of Voice passen. Sei spezifisch.' },
  { id: 'icps', label: 'Was ist relevant für meine ICPs?', prompt: 'Was ist in diesem Material relevant für unsere ICPs? Gehe jeden ICP kurz durch und sage, was trifft zu und was nicht.' },
  { id: 'summary', label: 'Zusammenfassen', prompt: 'Fasse den Inhalt kurz zusammen — aber immer mit Bezug zu unserer Brand-DNA, nicht generisch.' },
] as const

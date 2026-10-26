export const CHAT_ROOMS = [
  'Teacher Lounge',
  'Blender',
  'Tinkercad',
  'E-Sports',
  'Minecraft Command Science',
  'Roblox Game Design',
  'Game Art & Animation',
] as const;

export type ChatRoom = typeof CHAT_ROOMS[number];

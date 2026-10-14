export const CHAT_ROOMS = [
  'Blender',
  'Tinkercad',
  'E-Sports',
  'Minecraft Command Science',
  'Roblox Game Design',
] as const;

export type ChatRoom = typeof CHAT_ROOMS[number];

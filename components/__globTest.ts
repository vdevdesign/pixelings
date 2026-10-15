// Vite Glob test
const profiles = import.meta.glob('../assets/pixelings-profiles/*.png', { eager: true });
export default profiles;

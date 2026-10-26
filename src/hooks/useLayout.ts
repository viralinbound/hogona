import { useWindowDimensions } from 'react-native';

/**
 * Breakpoints shared by every screen.
 * - phone: the default single column
 * - wide: ≥ 840 dp (tablet landscape, iPad, large foldables) → two columns
 * - tablet: shortest side ≥ 600 dp (any tablet/iPad, either orientation)
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 840;
  const tablet = Math.min(width, height) >= 600;
  return { width, height, wide, tablet, gutter: tablet ? 32 : 20 };
}

/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { COLORS } from './styles';

export const Colors = {
  light: {
    text: COLORS.TEXT.LIGHT_MODE,
    background: COLORS.WHITE,
    tint: COLORS.INFO.LIGHT,
    icon: COLORS.ICON.LIGHT,
    tabIconDefault: COLORS.TAB.DEFAULT,
    tabIconSelected: COLORS.TAB.SELECTED.LIGHT,
  },
  dark: {
    text: COLORS.TEXT.DARK_MODE,
    background: COLORS.BACKGROUND.DARK,
    tint: COLORS.WHITE,
    icon: COLORS.ICON.DARK,
    tabIconDefault: COLORS.TAB.DEFAULT,
    tabIconSelected: COLORS.TAB.SELECTED.DARK,
  },
};

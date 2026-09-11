module.exports = {
  default: {},
  useSharedValue: (v) => ({ value: v }),
  useAnimatedStyle: () => ({}),
  makeMutable: (v) => ({ value: v }),
  withTiming: (v) => v,
  withSpring: (v) => v,
  withRepeat: (v) => v,
  withSequence: (v) => v,
  Easing: { linear: (v) => v },
};

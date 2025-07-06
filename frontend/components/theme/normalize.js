// theme/normalize.js
// import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import{scale,moderateScale,verticalScale} from 'react-native-size-matters'
export const normalizeFont = (size) => moderateScale(size);
export const normalizeSpace = (size) => scale(size);
export const normalizeHeight = (size) => verticalScale(size);

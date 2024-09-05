import { formatDistanceToNowStrict, isAfter } from 'date-fns';
import en from 'date-fns/locale/en-US';

/** @param {string} timestamp - 2023-05-24T20:43:50.000Z
 * @param {string} locale
 */
export const formatTimestamp = (
  timestamp: string,
  locale: string = 'en',
  options?: Intl.DateTimeFormatOptions,
): string => {
  const date = new Date(timestamp);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    timeZoneName: 'short',
  };

  const intlOptions = { ...defaultOptions, ...options };
  const nativeIntl = new Intl.DateTimeFormat(locale, intlOptions);

  return nativeIntl.format(date);
};

export const formatDeployDetailsTimestamp = (timestamp: string, locale: string = 'en'): string => {
  const date = new Date(timestamp);

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedDate = dateFormatter.format(date);

  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
  const formattedTime = timeFormatter.format(date);

  return `${formattedDate}, ${formattedTime}`;
};

/** @param {string} timestamp - 2023-05-24T20:43:50.000Z */
export const formatTimestampAge = (timestamp: string): string => {
  const date = new Date(timestamp);

  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: { ...en },
    roundingMethod: 'floor',
  });
};

export const getCurrentTime = () => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
};

export const isExpired = (date?: string) => {
  if (!date) {
    return true;
  }

  return isAfter(new Date(), new Date(date));
};

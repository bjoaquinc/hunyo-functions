import { SMSData } from './utils/types';
import * as functions from 'firebase-functions';
import axios from 'axios';

export const sendSMS = async (smsData: SMSData) => {
  const { phoneNumber: number, message, senderName: sendername } = smsData;
  const URL_ENDPOINT = 'https://api.semaphore.co/api/v4/messages';
  const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const payload = {
    apikey: process.env.SEMAPHORE_API_KEY,
    message,
    number: number
      .split('')
      .filter((l) => numbers.includes(l))
      .join(''),
    sendername,
  };

  const response = await axios.post(URL_ENDPOINT, payload);
  functions.logger.debug('Sms Response', response);
};

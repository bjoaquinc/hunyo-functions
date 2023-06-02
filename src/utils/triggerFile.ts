// import { PubSub } from '@google-cloud/pubsub';
// import * as functions from 'firebase-functions';

// const trigger = async () => {
//   const pubsub = new PubSub({
//     apiEndpoint: 'http://localhost:8085',
//   });

//   const SCHEDULED_FUNCTION_TOPIC = 'firebase-schedule-fixImageUpload';
//   functions.logger.log(
//     `Trigger scheduled function via PubSub topic: ${SCHEDULED_FUNCTION_TOPIC}`
//   );
//   const msg = await pubsub.topic(SCHEDULED_FUNCTION_TOPIC).publishJSON(
//     {
//       foo: 'bar',
//     },
//     { attr1: 'value1' }
//   );
//   functions.logger.log(msg);
// };

// trigger();

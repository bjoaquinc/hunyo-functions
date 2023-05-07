import * as functions from 'firebase-functions';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Invite, Message, User } from './utils/types';
import { dbDocRefs } from './utils/db';
import { createMessage } from './messages';

export const onCreateInvite = functions
  .region('asia-southeast2')
  .firestore.document('invites/{inviteId}')
  .onCreate(async (snap, context) => {
    try {
      const inviteData = snap.data() as Invite;
      const { company, invitedBy } = inviteData;
      const userSnap = await dbDocRefs.getUserRef(company.id, invitedBy).get();
      if (!userSnap.exists) {
        throw new Error('User does not exist');
      }
      const userData = { id: userSnap.id, ...userSnap.data() } as User & {
        id: string;
      };
      const inviteId = context.params.inviteId;
      let INVITE_LINK;
      if (process.env.FUNCTIONS_EMULATOR) {
        INVITE_LINK = `http://localhost:8080/invites/${inviteId}`;
      } else {
        INVITE_LINK = `https://hunyo.design/invites/${inviteId}`;
      }
      const message: Message = {
        createdAt:
          // eslint-disable-next-line max-len
          FieldValue.serverTimestamp() as Timestamp,
        // eslint-disable-next-line max-len
        subject: `${userData.name.first} ${userData.name.last} has invited you to join ${company.name} on Hunyo`,
        recipients: [
          {
            email: inviteData.email,
            type: 'to',
          },
        ],
        body: 'Test',
        fromName: 'Hunyo Team',
        template: {
          name: 'Team Invite Message',
          data: {
            teamMemberName: `${userData.name.first} ${userData.name.last}`,
            companyName: company.name,
            inviteLink: INVITE_LINK,
          },
        },
      };
      await createMessage(message);
      return functions.logger.log(
        `Successfully sent email to ${inviteData.email}`
      );
    } catch (error) {
      functions.logger.error(error);
    }
  });

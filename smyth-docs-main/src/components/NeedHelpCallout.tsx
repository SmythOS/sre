import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { HelpCallout } from './HelpCallout';

const NeedHelpCallout: React.FC = () => {
  const { siteConfig } = useDocusaurusContext();
  const {
    supportFormUrl,
    supportEmail,
    supportDiscordUrl,
  } = siteConfig.customFields as {
    supportFormUrl: string;
    supportEmail: string;
    supportDiscordUrl: string;
  };
  
  return (
    <HelpCallout title="Need more help?">
       Stuck on something or have a question?&nbsp;
      <Link to={supportFormUrl} target="_blank" rel="noopener noreferrer">
        Talk to us
      </Link>, hop into the&nbsp;
      <Link to={supportDiscordUrl} target="_blank" rel="noopener noreferrer">
        SmythOS Discord
      </Link>, or just send us an email at&nbsp;
      <Link to={`mailto:${supportEmail}`}>{supportEmail}</Link>.  
      We're always happy to help.
    </HelpCallout>
  );
};

export default NeedHelpCallout;

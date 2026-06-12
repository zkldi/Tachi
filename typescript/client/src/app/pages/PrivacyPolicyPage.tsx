import useSetSubheader from "#components/layout/header/useSetSubheader";
import ExternalLink from "#components/util/ExternalLink";
import { TachiConfig } from "#lib/config";

export default function PrivacyPolicyPage() {
	useSetSubheader(["Dashboard", "GDPR/Legal Stuff"]);

	return (
		<div className="privacy-policy">
			<h2>What data do we collect?</h2>
			<li>Personally identifiable information (email address)</li>
			<li>Your submitted scores.</li>
			<h2>How do we collect your data?</h2>
			<p>
				You directly provide {TachiConfig.NAME} with most of the data we collect. We collect
				data and process data when you:
			</p>
			<li>Register</li>
			<li>Submit scores</li>
			<h2>How will we use your data?</h2>
			<p>{TachiConfig.NAME} collects your data so that we can:</p>
			<li>Login</li>
			<li>Manage our score database</li>
			<li>Provide you with statistics</li>
			<h2>How do we store your data?</h2>
			<p>{TachiConfig.NAME} securely stores your data on our server in Norway.</p>
			<p>
				{TachiConfig.NAME} will keep your email for as long as you use the service. If you
				elect to terminate your account, your data will be securely erased.
			</p>
			<h2>Marketing</h2>
			<p>
				No advertising agencies are associated with this site, nor is your information given
				to any of them.
			</p>
			<h2>What are your data protection rights?</h2>
			<p>
				{TachiConfig.NAME} would like to make sure you are fully aware of all of your data
				protection rights. Every user is entitled to the following:
			</p>
			<p>
				The right to access - You have the right to request {TachiConfig.NAME} for copies of
				your personal data.
			</p>
			<p>
				The right to rectification - You have the right to request that {TachiConfig.NAME}{" "}
				correct any information you believe is inaccurate. You also have the right to
				request
				{TachiConfig.NAME} to complete the information you believe is incomplete.
			</p>
			<p>
				The right to erasure - You have the right to request that {TachiConfig.NAME} erase
				your personal data, under certain conditions.
			</p>
			<p>
				The right to restrict processing - You have the right to request that{" "}
				{TachiConfig.NAME} restrict the processing of your personal data, under certain
				conditions.
			</p>
			<p>
				The right to object to processing - You have the right to object to{" "}
				{TachiConfig.NAME}'s processing of your personal data, under certain conditions.
			</p>
			<p>
				The right to data portability - You have the right to request that{" "}
				{TachiConfig.NAME} transfer the data that we have collected to another organization,
				or directly to you, under certain conditions.
			</p>
			<p>
				If you make a request, providing I am not dead, I have one month to respond to you.
				If you would like to exercise any of these rights, please contact me at this email:
				zkldi.dev@gmail.com
			</p>
			<h2>Cookies</h2>
			<p>
				Cookies are text files placed on your computer to collect standard Internet log
				information and visitor behavior information. When you visit our websites, we may
				collect information from you automatically through cookies or similar technology
			</p>
			<p> For further information, visit allaboutcookies.org.</p>
			<h2>How do we use cookies?</h2>
			<p>
				{TachiConfig.NAME} uses cookies in a range of ways to improve your experience on our
				website, including, and limited to:
			</p>
			<li>Keeping you signed in</li>
			<h2>What types of cookies do we use?</h2>
			<p>
				Functionality - {TachiConfig.NAME} uses these cookies so that we recognize you on
				our website and remember your previously selected preferences. These could include
				what language you prefer and location you are in. No third-party cookies are used.
			</p>
			<h2>How to manage cookies</h2>
			<p>
				You can set your browser not to accept cookies, and the above website tells you how
				to remove cookies from your browser. However, in a few cases, some of our website
				features may not function as a result.
			</p>
			<h2>Privacy policies of other websites</h2>
			<p>
				The {TachiConfig.NAME} website contains links to other websites. Our privacy policy
				applies only to our website, so if you click on a link to another website, you
				should read their privacy policy.
			</p>
			<h2>Changes to our privacy policy</h2>
			<p>
				{TachiConfig.NAME} keeps its privacy policy under regular review and places any
				updates on this web page. This privacy policy was last updated on 15 September 2020.
			</p>
			<h2>How to contact us</h2>
			<p>
				If you have any questions about {TachiConfig.NAME}'s privacy policy, the data we
				hold on you, or you would like to exercise one of your data protection rights,
				please do not hesitate to contact us.
			</p>
			<p>Email us at: zk@tachi.ac</p>
			<h2>How to contact the appropriate authority</h2>
			<p>
				Should you wish to report a complaint or if you feel that {TachiConfig.NAME} has not
				addressed your concern in a satisfactory manner, you may contact the Information
				Commissioner's Office.
			</p>
			<p>
				Website: <ExternalLink href="https://ico.org.uk">https://ico.org.uk</ExternalLink>
			</p>
		</div>
	);
}

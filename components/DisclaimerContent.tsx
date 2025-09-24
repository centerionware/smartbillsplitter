import React from 'react';

export const DisclaimerContent: React.FC = () => (
    <div className="space-y-6 text-slate-600 dark:text-slate-300">
        <div>
            <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-100">On-Device Data Storage</h3>
            <p>
            All your core application data—bills, participants, settings, etc.—is stored exclusively in your browser's <strong>IndexedDB</strong> database. This is a private, sandboxed database that lives directly on your device (your computer or phone).
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 pl-2">
            <li><strong>We do not have a central database of user bills.</strong></li>
            <li><strong>We never see or have access to your personal financial data.</strong></li>
            <li>Because the data is only on your device, you are responsible for it. If you clear your browser data, your information will be permanently lost unless you have created a backup using the "Export Data" feature.</li>
            </ul>
        </div>
        
        <div>
            <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-100">Ephemeral Server Data for Sync & Share</h3>
            <p>
            When you use the <strong>"Sync with Another Device"</strong> or <strong>"Share Bill"</strong> features, a temporary, end-to-end encrypted copy of your data is sent to our server.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 pl-2">
                <li>The data is <strong>end-to-end encrypted</strong> on your device before it is sent. This means we, the server operators, cannot read its contents.</li>
                <li>This encrypted data is stored temporarily <strong>in-memory</strong> on our server and is never written to a permanent database.</li>
                <li>"Sync" data expires and is deleted after <strong>5 minutes</strong>.</li>
                <li>"Share Bill" encrypted data expires and is deleted after <strong>30 days</strong>.</li>
            </ul>
            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <h4 className="font-semibold text-slate-700 dark:text-slate-200">How Secure Bill Sharing Works</h4>
                <p className="text-sm mt-1">
                    To allow someone to view a shared bill via a link, we must provide them with a way to decrypt it. To do this securely, we temporarily store a one-time use <strong>decryption key</strong> on our server, separate from the encrypted bill data itself. The link you share contains a unique ID to fetch this key.
                </p>
                <ul className="list-disc list-inside space-y-1 mt-2 pl-2 text-sm">
                    <li>This key is "consumable" - it is <strong>permanently deleted</strong> from our server immediately after it is accessed for the first time.</li>
                    <li>If unused, the key is automatically deleted after <strong>24 hours</strong>.</li>
                    <li>This process ensures that only the intended recipient with the unique link can decrypt the bill information, and only for a limited time. The sender's public key, used for verifying the bill's authenticity, is part of the encrypted data and is not stored separately.</li>
                </ul>
            </div>
        </div>

        <div>
            <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-100">Third-Party Services & Scripts</h3>
            <p>
            To provide advanced features, this application interacts with a few external services and utilizes third-party Javascript libraries.
            </p>
            <div className="mt-4 space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <h4 className="font-semibold text-slate-700 dark:text-slate-200">Google Gemini API</h4>
                <p className="text-sm mt-1">
                The "Scan with AI" feature sends your receipt image to our server, which securely forwards it to the <strong>Google Gemini API</strong> for analysis. The extracted text is sent back to your device and is not stored by us. Your use of this feature is subject to Google's Privacy Policy.
                </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <h4 className="font-semibold text-slate-700 dark:text-slate-200">Stripe Payments</h4>
                <p className="text-sm mt-1">
                For Pro subscriptions, our server communicates with <strong>Stripe</strong> to handle all billing features. We do not handle or store your credit card information directly; all payment details are securely managed by Stripe.
                </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <h4 className="font-semibold text-slate-700 dark:text-slate-200">Google AdSense</h4>
                <p className="text-sm mt-1">
                If you are using the free version, we use <strong>Google AdSense</strong> to display advertisements. This service may load external scripts from Google and may use cookies to serve ads. You can learn more about how Google uses data in their privacy policy.
                </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <h4 className="font-semibold text-slate-700 dark:text-slate-200">Core Application Libraries</h4>
                <p className="text-sm mt-1">
                This web application is built using modern web technologies. To ensure fast performance, core libraries such as <strong>React</strong> are loaded from secure, third-party Content Delivery Networks (CDNs). These external scripts are essential for the application's functionality.
                </p>
            </div>
            </div>
        </div>

        <div>
            <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-100">No Warranties</h3>
            <p>
            This application is provided "as is," without warranty of any kind. We are not responsible for any data loss. We strongly encourage you to use the export feature to back up your data regularly.
            </p>
        </div>
    </div>
);
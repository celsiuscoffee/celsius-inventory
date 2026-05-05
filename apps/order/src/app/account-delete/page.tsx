import Image from "next/image";
import Link from "next/link";

export default function AccountDeletePage() {
  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <Image
          src="/images/celsius-logo-sm.jpg"
          alt="Celsius Coffee"
          width={48}
          height={48}
          className="mb-6 h-12 w-12 rounded-lg"
        />
        <h1 className="text-2xl font-bold text-gray-900">
          Delete Your Account
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Celsius Coffee account &amp; data deletion
        </p>

        <div className="mt-8 space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">
              How to request deletion
            </h2>
            <p>
              You can request permanent deletion of your Celsius Coffee account
              and all associated personal data using either method below.
            </p>
            <ol className="mt-3 list-decimal pl-5 space-y-2">
              <li>
                <strong>By email:</strong> Send a message to{" "}
                <strong>barista@celsiuscoffee.com</strong> from the email address
                linked to your account. Include the phone number on your
                account and the subject line &quot;Delete my account&quot;.
              </li>
              <li>
                <strong>In person:</strong> Visit any Celsius Coffee outlet
                with photo ID matching your account details and ask staff to
                submit a deletion request on your behalf.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">
              What gets deleted
            </h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Your name, email, phone number, and birthday</li>
              <li>Your points balance and rewards history</li>
              <li>Your full transaction and visit history</li>
              <li>Push notification tokens linked to your devices</li>
              <li>SMS opt-in records and marketing preferences</li>
            </ul>
            <p className="mt-2 text-gray-500">
              Anonymised aggregate analytics that cannot be linked back to you
              may be retained.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
            <p>
              We will permanently delete your account within{" "}
              <strong>30 days</strong> of receiving a verified request, and we
              will email a confirmation when the deletion is complete.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">
              Important note
            </h2>
            <p>
              Deletion is permanent and cannot be reversed. Your unredeemed
              points will be forfeited at the time of deletion. If you simply
              want to stop receiving promotional SMS, you can opt out without
              deleting your account by replying STOP to any promotional
              message.
            </p>
          </section>
        </div>

        <div className="mt-10 border-t pt-6 text-xs text-gray-400">
          <p>
            See our{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>{" "}
            for full details on how we handle your personal data under the
            Personal Data Protection Act 2010 (Act 709) of Malaysia.
          </p>
        </div>
      </div>
    </div>
  );
}

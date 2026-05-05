import Image from "next/image";
import Link from "next/link";

export default function SupportPage() {
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
        <h1 className="text-2xl font-bold text-gray-900">Support</h1>
        <p className="mt-2 text-sm text-gray-500">
          Help with your Celsius Coffee account, orders, and rewards.
        </p>

        <div className="mt-8 space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">Contact us</h2>
            <p className="mt-2">
              The fastest way to reach us is by email. We reply within one
              business day, Monday to Friday.
            </p>
            <p className="mt-3">
              <strong>Email:</strong>{" "}
              <a
                href="mailto:barista@celsiuscoffee.com"
                className="text-[#160800] underline"
              >
                barista@celsiuscoffee.com
              </a>
            </p>
            <p className="mt-1">
              <strong>In person:</strong> Speak to any barista at a Celsius
              Coffee outlet — they can help with most account, order, and
              rewards questions on the spot.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">
              Common questions
            </h2>

            <h3 className="mt-4 font-semibold text-gray-900">
              I didn&apos;t receive my OTP code
            </h3>
            <p className="mt-1">
              OTP codes are sent by SMS and usually arrive within 30 seconds.
              If you don&apos;t see one, check that your phone has signal,
              wait one minute, and tap <em>Resend code</em>. If it still
              doesn&apos;t come through, email us with your phone number and
              we&apos;ll look into it.
            </p>

            <h3 className="mt-4 font-semibold text-gray-900">
              My order didn&apos;t go through
            </h3>
            <p className="mt-1">
              If your payment was charged but the order didn&apos;t appear,
              show your bank notification to a barista at the outlet — they
              can manually fulfil the order or process a refund. For payments
              that failed entirely, no money has been taken and you can simply
              try again.
            </p>

            <h3 className="mt-4 font-semibold text-gray-900">
              My loyalty points are missing
            </h3>
            <p className="mt-1">
              Points are awarded after the order is marked complete by
              outlet staff. If a transaction doesn&apos;t show up after 24
              hours, email us your phone number and the date and outlet of
              the visit, and we&apos;ll credit the points manually.
            </p>

            <h3 className="mt-4 font-semibold text-gray-900">
              How do I redeem a reward?
            </h3>
            <p className="mt-1">
              Open the app, go to the <em>Rewards</em> tab, pick the reward
              you want, and tap <em>Redeem</em>. Show the barista the
              redemption code on the next screen — they&apos;ll enter it at
              the till and your points will be deducted.
            </p>

            <h3 className="mt-4 font-semibold text-gray-900">
              How do I update my phone number, name, or email?
            </h3>
            <p className="mt-1">
              In the app: tap <em>Account</em> → tap your profile to edit
              your name, email, or birthday. To change the phone number on
              file, email{" "}
              <a
                href="mailto:barista@celsiuscoffee.com"
                className="text-[#160800] underline"
              >
                barista@celsiuscoffee.com
              </a>{" "}
              from your registered email — phone changes need extra
              verification to keep your account safe.
            </p>

            <h3 className="mt-4 font-semibold text-gray-900">
              How do I stop the promotional SMS messages?
            </h3>
            <p className="mt-1">
              Reply <strong>STOP</strong> to any promotional SMS from us.
              Transactional messages like OTP codes will continue. You can
              also opt out by emailing us or asking any barista.
            </p>

            <h3 className="mt-4 font-semibold text-gray-900">
              How do I delete my account?
            </h3>
            <p className="mt-1">
              In the app: <em>Account</em> →{" "}
              <em>Settings</em> → <em>Delete my account</em>. Or see our{" "}
              <Link href="/account-delete" className="text-[#160800] underline">
                account deletion page
              </Link>{" "}
              for full details and alternative methods.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">
              About Celsius Coffee
            </h2>
            <p className="mt-2">
              Celsius Coffee Sdn. Bhd. is a Malaysian specialty coffee brand.
              Find us at celsiuscoffee.com and on Instagram{" "}
              <a
                href="https://instagram.com/celsius.coffee"
                className="text-[#160800] underline"
              >
                @celsius.coffee
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-10 border-t pt-6 text-xs text-gray-400">
          <p>
            See our{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>{" "}
            for details on how we handle your personal data.
          </p>
        </div>
      </div>
    </div>
  );
}

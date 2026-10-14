
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, ArrowLeft, ShieldCheck } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

function StudentQRComplaint() {
  const navigate = useNavigate();

  useEffect(() => {
    let scanner;

    const timer = setTimeout(() => {
      scanner = new Html5QrcodeScanner(
        "campus-complaint-qr-reader",
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
        },
        false
      );

      scanner.render(
        (decodedText) => {
          let location = "";

          try {
            const url = new URL(decodedText);
            location =
              url.searchParams.get("location") ||
              url.searchParams.get("room") ||
              "";
          } catch {
            const match = decodedText.match(
              /^SCAMPUS:ROOM:([A-Za-z0-9_-]+)$/i
            );

            if (match) location = match[1];
          }

          if (!location) {
            window.alert(
              "Invalid campus QR code. Please scan a valid room QR code."
            );
            return;
          }

          scanner.clear().catch(() => {});

          navigate(
            `/student-maintenance?newRequest=1&location=${encodeURIComponent(location)}`
          );
        },
        () => {}
      );
    }, 100);

    return () => {
      clearTimeout(timer);

      if (scanner) {
        scanner.clear().catch(() => {});
      }
    };
  }, [navigate]);

  return (
    <div className="student-maintenance-page">
      <div className="student-page-header">
        <div>
          <p className="page-label">QUICK REPORT</p>
          <h1>QR Complaint</h1>
          <p>
            Scan a classroom QR code to report a campus issue.
          </p>
        </div>
      </div>

      <section className="maintenance-form-card">
        <div className="student-panel-header">
          <div>
            <h2>Scan Campus QR Code</h2>
            <p>
              Point your camera at the QR code displayed
              in your classroom, laboratory, or campus facility.
            </p>
          </div>

          <QrCode size={28} />
        </div>

        <div
          id="campus-complaint-qr-reader"
          style={{
            maxWidth: 500,
            margin: "24px auto",
          }}
        />

        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: "#f0fdfa",
            color: "#115e59",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <ShieldCheck size={22} />

          <p style={{ margin: 0 }}>
            After scanning, check the room location and
            describe your problem before submitting the complaint.
          </p>
        </div>

        <button
          type="button"
          className="secondary-student-button"
          onClick={() => navigate("/student-dashboard")}
          style={{ marginTop: 20 }}
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>
      </section>
    </div>
  );
}

export default StudentQRComplaint;

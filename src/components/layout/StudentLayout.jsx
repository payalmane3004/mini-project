import StudentSidebar from "./StudentSidebar";
import StudentTopbar from "./StudentTopbar";

function StudentLayout({ children }) {
  return (
    <div className="student-app">

      <StudentSidebar />

      <div className="student-main-area">

        <StudentTopbar />

        <main className="student-content">
          {children}
        </main>

      </div>

    </div>
  );
}

export default StudentLayout;
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import SOSButton from '../sos/SOSButton';
import SOSAlert from '../sos/SOSAlert';

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <SOSButton />
      <SOSAlert />
    </div>
  );
}

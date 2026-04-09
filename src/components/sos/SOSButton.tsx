import { useState, useCallback } from 'react';
import { AlertTriangle, Loader2, Phone, MapPin, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface SOSButtonProps {
  onAlertCreated?: (alertId: string) => void;
}

export default function SOSButton({ onAlertCreated }: SOSButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'confirm' | 'sending' | 'sent'>('confirm');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [alertId, setAlertId] = useState<string | null>(null);

  const sendSOS = useCallback(async () => {
    if (!user) return;
    setStep('sending');
    setError(null);

    try {
      // Get current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude } = position.coords;

      // Create SOS alert
      const { data, error: sosError } = await supabase
        .from('sos_alerts')
        .insert({
          user_id: user.id,
          location: `POINT(${longitude} ${latitude})`,
          message: message || null,
        })
        .select('id')
        .single();

      if (sosError) throw new Error(sosError.message);

      // Update user location
      await supabase
        .from('profiles')
        .update({
          last_known_lat: latitude,
          last_known_lng: longitude,
          last_location_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      setAlertId(data.id);
      setStep('sent');
      onAlertCreated?.(data.id);

      // Broadcast via Realtime
      const channel = supabase.channel('sos-live');
      channel.send({
        type: 'broadcast',
        event: 'new-sos',
        payload: { sos_id: data.id, lat: latitude, lng: longitude, user_id: user.id },
      });
    } catch (err) {
      setError(err instanceof GeolocationPositionError
        ? 'Байршил тодорхойлж чадсангүй. GPS асаана уу.'
        : (err as Error).message
      );
      setStep('confirm');
    }
  }, [user, message, onAlertCreated]);

  const cancelAlert = useCallback(async () => {
    if (!alertId) return;
    await supabase
      .from('sos_alerts')
      .update({ status: 'false_alarm', resolved_at: new Date().toISOString() })
      .eq('id', alertId);
    setIsOpen(false);
    setStep('confirm');
    setMessage('');
    setAlertId(null);
  }, [alertId]);

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Floating SOS button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-red-500 text-white rounded-full shadow-lg shadow-red-500/30 hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center group"
        title="SOS Тусламж"
      >
        <AlertTriangle className="w-6 h-6 group-hover:animate-pulse" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            {step === 'confirm' && (
              <>
                <div className="bg-red-500 p-6 text-center">
                  <AlertTriangle className="w-12 h-12 text-white mx-auto mb-3" />
                  <h2 className="text-xl font-bold text-white">SOS Тусламж</h2>
                  <p className="text-red-100 text-sm mt-1">Таны байршлыг ойролцоох гишүүдэд илгээнэ</p>
                </div>
                <div className="p-6">
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">{error}</div>
                  )}
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Нэмэлт мэдээлэл (заавал биш)..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none mb-4"
                    rows={2}
                  />
                  <button
                    onClick={sendSOS}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors mb-3"
                  >
                    <Send className="w-5 h-5" /> SOS илгээх
                  </button>
                  <button onClick={() => setIsOpen(false)} className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700">
                    Цуцлах
                  </button>
                </div>
              </>
            )}

            {step === 'sending' && (
              <div className="p-12 text-center">
                <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
                <h2 className="text-lg font-bold text-gray-900">Илгээж байна...</h2>
                <p className="text-sm text-gray-500 mt-1">Байршлыг тодорхойлж байна</p>
              </div>
            )}

            {step === 'sent' && (
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">SOS илгээгдлээ!</h2>
                <p className="text-sm text-gray-500 mb-6">Ойролцоох гишүүдэд мэдэгдэл илгээлээ. Тэд удахгүй хариу өгнө.</p>

                <div className="bg-gray-50 rounded-xl p-4 mb-4 text-left">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Яаралтай утас</h3>
                  <a href="tel:105" className="flex items-center gap-2 text-sm text-red-600 font-medium mb-1">
                    <Phone className="w-4 h-4" /> 105 - Түргэн тусламж
                  </a>
                  <a href="tel:102" className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                    <Phone className="w-4 h-4" /> 102 - Цагдаа
                  </a>
                </div>

                <button
                  onClick={cancelAlert}
                  className="w-full py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 mb-2"
                >
                  Буруу дарсан — цуцлах
                </button>
                <button onClick={() => setIsOpen(false)} className="w-full py-2.5 text-sm text-gray-400">
                  Хаах
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

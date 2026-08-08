import { useState, useEffect } from "react";
import api from "@/lib/api";
import { format } from "date-fns";
import { Bell, Check, Mail, MessageSquare, Smartphone, Settings, CheckCircle2, AlertCircle, Briefcase, CreditCard, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
      emailEnabled: true,
      smsEnabled: false,
      whatsappEnabled: false,
      inAppEnabled: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    fetchSettings();
  }, []);

  const fetchNotifications = () => {
      api.get("/notifications?size=50").then(res => {
          setNotifications(res.data.content || []);
      });
  };

  const fetchSettings = () => {
      api.get("/notifications/settings").then(res => {
          if (res.data) setSettings(res.data);
          setLoading(false);
      });
  };

  const markAsRead = (id: number) => {
      api.post(`/notifications/${id}/read`).then(() => {
          setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
      });
  };

  const markAllAsRead = () => {
      api.post(`/notifications/mark-all-read`).then(() => {
          setNotifications(notifications.map(n => ({ ...n, read: true })));
      });
  };

  const deleteOne = (id: number) => {
      api.delete(`/notifications/${id}`).then(() => {
          setNotifications(prev => prev.filter(n => n.id !== id));
      });
  };

  const clearAll = () => {
      if (notifications.length === 0) return;
      if (!window.confirm("Clear all notifications?")) return;
      api.delete("/notifications").then(() => setNotifications([]));
  };

  const toggleSetting = (key: string, value: boolean) => {
      const updated = { ...settings, [key]: value };
      setSettings(updated);
      api.put("/notifications/settings", updated);
  };

  const getIcon = (type: string) => {
      switch (type) {
          case 'TASK': return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
          case 'PAYMENT': return <CreditCard className="w-5 h-5 text-green-500" />;
          case 'LEAD': return <AlertCircle className="w-5 h-5 text-purple-500" />;
          case 'PROJECT': return <Briefcase className="w-5 h-5 text-orange-500" />;
          default: return <Bell className="w-5 h-5 text-slate-500" />;
      }
  };

  return (
    <div className="p-8 h-full flex flex-col bg-slate-50">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 shrink-0 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Notification Center</h1>
          <p className="text-muted-foreground mt-1">Manage your alerts and delivery preferences.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={markAllAsRead} variant="outline" className="bg-white">
              <Check className="w-4 h-4 mr-2" /> Mark All as Read
          </Button>
          <Button onClick={clearAll} variant="outline" className="bg-white text-slate-500 hover:text-destructive">
              <Trash2 className="w-4 h-4 mr-2" /> Clear All
          </Button>
        </div>
      </div>

      <div className="flex-1 max-w-4xl w-full mx-auto pb-12">
        <Tabs defaultValue="inbox" className="w-full">
            <TabsList className="mb-6">
                <TabsTrigger value="inbox" className="flex items-center gap-2"><Bell className="w-4 h-4" /> Inbox</TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2"><Settings className="w-4 h-4" /> Preferences</TabsTrigger>
            </TabsList>
            
            <TabsContent value="inbox">
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    {notifications.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Bell className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="font-bold text-slate-700 text-lg">You're all caught up!</h3>
                            <p className="text-sm">No new notifications right now.</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((n: any) => (
                                <div key={n.id} className={`p-4 flex gap-4 transition-colors ${n.read ? 'bg-white' : 'bg-blue-50/30'}`}>
                                    <div className="shrink-0 mt-1">
                                        {getIcon(n.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-4">
                                            <h4 className={`font-semibold text-sm ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</h4>
                                            <span className="text-xs text-slate-400 whitespace-nowrap">{format(new Date(n.createdAt), 'MMM d, h:mm a')}</span>
                                        </div>
                                        <p className={`text-sm mt-1 ${n.read ? 'text-slate-500' : 'text-slate-700 font-medium'}`}>{n.message}</p>
                                        
                                        {n.actionUrl && (
                                            <a href={n.actionUrl} className="text-xs font-semibold text-blue-600 hover:underline mt-2 inline-block">
                                                View Details &rarr;
                                            </a>
                                        )}
                                    </div>
                                    <div className="shrink-0 flex items-center gap-1">
                                        {!n.read && (
                                            <button
                                                onClick={() => markAsRead(n.id)}
                                                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-blue-600 transition-colors"
                                                title="Mark as read"
                                            >
                                                <div className="w-2.5 h-2.5 bg-blue-600 rounded-full" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteOne(n.id)}
                                            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-destructive transition-colors"
                                            title="Delete"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </TabsContent>
            
            <TabsContent value="settings">
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden p-8">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 border-b pb-4">Delivery Channels</h3>
                    
                    {!loading && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Bell className="w-6 h-6" /></div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900">In-App Notifications</h4>
                                        <p className="text-sm text-slate-500">Alerts in the top right bell menu.</p>
                                    </div>
                                </div>
                                <Switch checked={settings.inAppEnabled} onCheckedChange={(c) => toggleSetting('inAppEnabled', c)} />
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div className="flex gap-4">
                                    <div className="p-3 bg-slate-100 text-slate-600 rounded-xl"><Mail className="w-6 h-6" /></div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900">Email Notifications</h4>
                                        <p className="text-sm text-slate-500">Receive summaries and urgent alerts via email.</p>
                                    </div>
                                </div>
                                <Switch checked={settings.emailEnabled} onCheckedChange={(c) => toggleSetting('emailEnabled', c)} />
                            </div>
                            
                            <div className="flex items-center justify-between opacity-50">
                                <div className="flex gap-4">
                                    <div className="p-3 bg-green-50 text-green-600 rounded-xl"><MessageSquare className="w-6 h-6" /></div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-slate-900">WhatsApp</h4>
                                            <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase tracking-wider">Premium</span>
                                        </div>
                                        <p className="text-sm text-slate-500">Instant delivery via Meta Graph API.</p>
                                    </div>
                                </div>
                                <Switch checked={settings.whatsappEnabled} onCheckedChange={(c) => toggleSetting('whatsappEnabled', c)} disabled />
                            </div>
                            
                            <div className="flex items-center justify-between opacity-50">
                                <div className="flex gap-4">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Smartphone className="w-6 h-6" /></div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-slate-900">SMS / Text</h4>
                                            <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase tracking-wider">Premium</span>
                                        </div>
                                        <p className="text-sm text-slate-500">Instant delivery via Twilio.</p>
                                    </div>
                                </div>
                                <Switch checked={settings.smsEnabled} onCheckedChange={(c) => toggleSetting('smsEnabled', c)} disabled />
                            </div>
                        </div>
                    )}
                </div>
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

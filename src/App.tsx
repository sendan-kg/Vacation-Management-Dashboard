import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  Upload,
  Users,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Crown,
  LogOut,
  LogIn,
  Printer
} from 'lucide-react';
import Papa from 'papaparse';
import Encoding from 'encoding-japanese';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, writeBatch, doc, getDocs } from 'firebase/firestore';

// --- 型定義 ---
interface EmployeeData {
  id: string;
  name: string;
  department: string;
  grantDate: string; // YYYY-MM-DD
  grantedDays: number;
  usedDays: number;
}

// --- カスタムX軸ラベル ---
const CustomizedAxisTick = (props: any) => {
  const { x, y, payload, isMobile } = props;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={isMobile ? 10 : 16}
        dx={isMobile ? -6 : 0}
        textAnchor={isMobile ? "start" : "middle"}
        fill="#64748b"
        fontSize={12}
        style={
          isMobile
            ? { writingMode: 'vertical-rl', textOrientation: 'upright' }
            : {}
        }
      >
        {payload.value}
      </text>
    </g>
  );
};

// --- 期限間近チェック ---
const isDeadlineApproaching = (grantDateStr: string) => {
  const normalizedDateStr = grantDateStr.replace(/\//g, '-');
  const grantDate = new Date(normalizedDateStr);
  if (isNaN(grantDate.getTime())) return false;
  
  const nextGrantDate = new Date(grantDate.getFullYear() + 1, grantDate.getMonth(), grantDate.getDate());
  const now = new Date();
  const threeMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
  
  return nextGrantDate <= threeMonthsFromNow;
};

export default function App() {
  const [data, setData] = useState<EmployeeData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [lastUpdatedYMD, setLastUpdatedYMD] = useState<string | null>(null);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  const isAdmin = user?.email === 'alwayshappys2.forever@gmail.com';

  useEffect(() => {
    // インアプリブラウザ（Instagram, LINE, Facebookなど）の検知
    const ua = window.navigator.userAgent.toLowerCase();
    const isInApp = /instagram|fban|fbav|line|micromessenger/.test(ua);
    setIsInAppBrowser(isInApp);
  }, []);

  useEffect(() => {
    if (lastUpdatedYMD) {
      document.title = `有給休暇消化率ダッシュボード${lastUpdatedYMD}`;
    } else {
      document.title = '有給休暇消化率ダッシュボード';
    }
  }, [lastUpdatedYMD]);

  // 認証状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // データの取得（リアルタイム同期）
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const unsubscribe = onSnapshot(
      collection(db, 'pto_data'),
      (snapshot) => {
        const fetchedData: EmployeeData[] = [];
        snapshot.forEach((doc) => {
          fetchedData.push(doc.data() as EmployeeData);
        });
        setData(fetchedData);
        setError(null);
      },
      (err) => {
        console.error('Firestore Error:', err);
        setError('データの取得に失敗しました。権限がない可能性があります。');
      }
    );

    const unsubscribeMeta = onSnapshot(
      doc(db, 'metadata', 'system'),
      (docSnap) => {
        if (docSnap.exists()) {
          setLastUpdated(docSnap.data().lastUpdated);
          setLastUpdatedYMD(docSnap.data().lastUpdatedYMD);
        } else {
          setLastUpdated(null);
          setLastUpdatedYMD(null);
        }
      },
      (err) => {
        console.error('Metadata fetch error:', err);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeMeta();
    };
  }, [user, isAuthReady]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/disallowed-useragent') {
        setError('このブラウザ（インアプリブラウザ）ではGoogleログインが制限されています。SafariやChromeなどの標準ブラウザで開き直してください。');
      } else {
        setError('ログインに失敗しました。');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setData([]);
    } catch (err) {
      console.error(err);
    }
  };

  // ウィンドウサイズを監視してモバイルかどうかを判定
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px未満をモバイルとする
    };
    
    // 初期チェック
    checkMobile();
    
    // リサイズイベントのリスナーを追加
    window.addEventListener('resize', checkMobile);
    
    // クリーンアップ
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // --- 計算ロジック ---
  const { totalGranted, totalUsed, overallRate, chartData, alertList } = useMemo(() => {
    let granted = 0;
    let used = 0;
    const chart: any[] = [];
    const alerts: EmployeeData[] = [];

    data.forEach((emp) => {
      granted += emp.grantedDays;
      used += emp.usedDays;
      const rate = emp.grantedDays > 0 ? (emp.usedDays / emp.grantedDays) * 100 : 0;
      
      chart.push({
        name: emp.name,
        department: emp.department,
        rate: Number(rate.toFixed(1)),
        used: emp.usedDays,
        granted: emp.grantedDays,
      });

      // 年5日取得義務の未達リスク（簡易判定：消化日数が5日未満）
      if (emp.usedDays < 5) {
        alerts.push(emp);
      }
    });

    // 消化率で降順ソート
    chart.sort((a, b) => b.rate - a.rate);

    // 取得日数5日未満のリストを付与日が古い順にソート
    alerts.sort((a, b) => {
      const dateA = new Date(a.grantDate.replace(/\//g, '-')).getTime();
      const dateB = new Date(b.grantDate.replace(/\//g, '-')).getTime();
      return dateA - dateB;
    });

    // モバイルの場合はトップ5、PCの場合はトップ10を抽出
    const displayCount = isMobile ? 5 : 10;
    const displayChartData = chart.slice(0, displayCount);

    return {
      totalGranted: granted,
      totalUsed: used,
      overallRate: granted > 0 ? ((used / granted) * 100).toFixed(1) : '0.0',
      chartData: displayChartData,
      alertList: alerts,
    };
  }, [data, isMobile]);

  // --- CSVアップロード処理 ---
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    
    // ファイルをArrayBufferとして読み込む（文字コード判定のため）
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        if (!buffer) {
          setError('ファイルの読み込みに失敗しました。');
          return;
        }

        // Uint8Arrayに変換
        const uint8Array = new Uint8Array(buffer);
        
        // 文字コードを判定
        const detectedEncoding = Encoding.detect(uint8Array);
        
        // UTF-8の文字列に変換
        const unicodeArray = Encoding.convert(uint8Array, {
          to: 'UNICODE',
          from: detectedEncoding || 'AUTO'
        });
        
        // 文字列に変換
        const csvString = Encoding.codeToString(unicodeArray);

        // PapaParseで解析
        Papa.parse(csvString, {
          header: false, // ヘッダー行が複数ある、または特殊なためfalseで読み込み
          skipEmptyLines: true,
          complete: (results) => {
            try {
              const rows = results.data as string[][];
              
              // データ行の開始位置を見つける (社員番号らしき数字から始まる行)
              let dataStartIndex = 0;
              for (let i = 0; i < rows.length; i++) {
                if (rows[i][0] && !isNaN(Number(rows[i][0])) && rows[i][1]) {
                  dataStartIndex = i;
                  break;
                }
              }

              if (dataStartIndex === 0) {
                 setError('データ行が見つかりませんでした。');
                 return;
              }

              const parsedData: EmployeeData[] = [];
              
              for (let i = dataStartIndex; i < rows.length; i++) {
                const row = rows[i];
                
                if (!row[1] && !row[4]) continue; // 社員番号も氏名もない行はスキップ
                
                const id = row[1]?.trim() || Math.random().toString(36).substring(2, 15);
                const department = row[2]?.trim() || '未設定';
                const name = row[4]?.trim() || '不明';
                const grantDate = row[8]?.trim() || '未設定';
                // 13列目（0始まりで13、CSVのN列）が「今年度付与日数」
                const grantedDays = Number(row[13]) || 0;
                // 6列目（0始まりで6、CSVのG列）が「取得日数」
                const usedDays = Number(row[6]) || 0;

                parsedData.push({
                  id,
                  name,
                  department,
                  grantDate,
                  grantedDays,
                  usedDays,
                });
              }
              
              if (parsedData.length > 0) {
                // Firestoreに一括保存
                const saveToFirestore = async () => {
                  setIsUploading(true);
                  try {
                    // 既存のデータをすべて削除（完全入れ替えのため）
                    const querySnapshot = await getDocs(collection(db, 'pto_data'));
                    
                    // 削除のバッチ処理（500件制限対策）
                    const deleteChunks = [];
                    let currentDeleteBatch = writeBatch(db);
                    let deleteCount = 0;
                    
                    querySnapshot.forEach((document) => {
                      currentDeleteBatch.delete(document.ref);
                      deleteCount++;
                      if (deleteCount === 500) {
                        deleteChunks.push(currentDeleteBatch.commit());
                        currentDeleteBatch = writeBatch(db);
                        deleteCount = 0;
                      }
                    });
                    if (deleteCount > 0) {
                      deleteChunks.push(currentDeleteBatch.commit());
                    }
                    await Promise.all(deleteChunks);

                    // 新しいデータを追加（500件制限対策）
                    const addChunks = [];
                    let currentAddBatch = writeBatch(db);
                    let addCount = 0;

                    // メタデータ（更新日）の保存
                    const today = new Date();
                    const dateString = `${today.getMonth() + 1}月${today.getDate()}日`;
                    const yyyy = today.getFullYear();
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const dd = String(today.getDate()).padStart(2, '0');
                    const dateStringYMD = `${yyyy}${mm}${dd}`;
                    const metadataRef = doc(db, 'metadata', 'system');
                    currentAddBatch.set(metadataRef, { lastUpdated: dateString, lastUpdatedYMD: dateStringYMD });
                    addCount++;

                    parsedData.forEach((emp) => {
                      const docRef = doc(db, 'pto_data', emp.id);
                      currentAddBatch.set(docRef, emp);
                      addCount++;
                      if (addCount === 500) {
                        addChunks.push(currentAddBatch.commit());
                        currentAddBatch = writeBatch(db);
                        addCount = 0;
                      }
                    });
                    if (addCount > 0) {
                      addChunks.push(currentAddBatch.commit());
                    }
                    await Promise.all(addChunks);

                    setError(null);
                  } catch (err: any) {
                    console.error('Firestore Write Error:', err);
                    setError(`データの保存に失敗しました: ${err.message}`);
                  } finally {
                    setIsUploading(false);
                  }
                };
                
                saveToFirestore();
              } else {
                setError('有効なデータが見つかりませんでした。CSVの形式を確認してください。');
              }
            } catch (err) {
              setError('CSVの解析中にエラーが発生しました。ファイルの形式を確認してください。');
              console.error(err);
            }
          },
          error: (err) => {
            setError(`CSVパースエラー: ${err.message}`);
          }
        });
      } catch (err) {
        setError('ファイルの文字コード変換に失敗しました。');
        console.error(err);
      }
    };

    reader.onerror = () => {
      setError('ファイルの読み込み中にエラーが発生しました。');
    };

    // ArrayBufferとして読み込み開始
    reader.readAsArrayBuffer(file);
    
    // inputの値をリセット（同じファイルを再度選択できるようにする）
    e.target.value = '';
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <Calendar className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">有給休暇ダッシュボード</h1>
          
          {isInAppBrowser ? (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mb-6 text-left">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-800 mb-1">標準ブラウザで開いてください</p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    InstagramやLINEなどのアプリ内ブラウザでは、Googleのセキュリティポリシーによりログインが制限されています。<br /><br />
                    右上のメニュー（...）から<strong>「ブラウザで開く」</strong>または<strong>「Safari/Chromeで開く」</strong>を選択してください。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 mb-8">
              ダッシュボードを閲覧するには、Googleアカウントでログインしてください。
            </p>
          )}

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm text-left">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isInAppBrowser}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-colors font-medium ${
              isInAppBrowser 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <LogIn className="w-5 h-5" />
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans print:bg-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as any}>
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 print:static print:border-none print:shadow-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
              <h1 className="text-xl font-bold text-slate-800 hidden sm:block">有給休暇 消化率ダッシュボード</h1>
              <h1 className="text-lg font-bold text-slate-800 sm:hidden print:hidden">有給ダッシュボード</h1>
              {lastUpdated && (
                <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 print:border-none print:bg-transparent print:p-0 print:text-slate-800">
                  {lastUpdated}時点
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 transition-colors text-sm font-medium border border-emerald-200"
              title="PDF出力 (印刷)"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">PDF出力</span>
            </button>
            {isAdmin && (
              <label className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 cursor-pointer transition-colors text-sm font-medium border border-blue-200 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">{isUploading ? '更新中...' : 'CSVデータ更新'}</span>
                <span className="sm:hidden">更新</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
              </label>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors text-sm font-medium border border-slate-200"
              title="ログアウト"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print:py-4 print:space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3 print:hidden">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {data.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
            <FileSpreadsheet className="w-16 h-16 text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-700 mb-2">データがありません</h2>
            <p className="text-slate-500 mb-6 max-w-md">
              {isAdmin 
                ? "右上の「CSVデータ更新」ボタンから、有給休暇のデータが含まれたCSVファイルをアップロードしてください。"
                : "現在、表示できる有給休暇データがありません。管理者がデータを更新するまでお待ちください。"}
            </p>
            {isAdmin && (
              <label className={`flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors font-medium shadow-sm ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <Upload className="w-5 h-5" />
                {isUploading ? 'アップロード中...' : 'CSVファイルをアップロード'}
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
              </label>
            )}
          </div>
        ) : (
          <>
            {/* サマリーカード */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4 print:break-inside-avoid">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">全体平均 消化率</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900">{overallRate}</span>
                <span className="text-lg font-medium text-slate-500">%</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">全体 消化日数 / 総付与日数</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900">{totalUsed}</span>
                <span className="text-lg font-medium text-slate-500">/ {totalGranted} 日</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">取得日数5日未満の職員</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900">{alertList.length}</span>
                <span className="text-lg font-medium text-slate-500">名</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:grid-cols-1 print:block print:space-y-8">
          {/* ランキングチャート */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:break-inside-avoid print:shadow-none print:border-gray-300">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-500" />
              個人別 消化率ランキング (トップ{isMobile ? '5' : '10'})
            </h2>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    height={isMobile ? 120 : 30}
                    interval={0}
                    tick={(props) => <CustomizedAxisTick {...props} isMobile={isMobile} />} 
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} unit="%" domain={[0, 100]} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number, name: string) => [
                      name === 'rate' ? `${value}%` : `${value}日`, 
                      name === 'rate' ? '消化率' : name === 'used' ? '消化日数' : '付与日数'
                    ]}
                  />
                  <ReferenceLine y={50} stroke="#cbd5e1" strokeDasharray="3 3" />
                  <Bar dataKey="rate" name="rate" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.rate >= 100 ? '#fbbf24' : entry.rate < 30 ? '#f87171' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <span className="font-medium text-amber-700">100%達成</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>消化率 30%以上</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <span>消化率 30%未満 (要フォロー)</span>
              </div>
            </div>
          </div>

          {/* 要注意リスト */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col print:break-inside-avoid print:shadow-none print:border-gray-300">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              取得日数5日未満リスト
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              労働基準法に基づく年5日の取得義務を満たしていない、またはペースが遅い職員のリストです。
            </p>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {alertList.length > 0 ? (
                alertList.map((emp) => {
                  const isRed = isDeadlineApproaching(emp.grantDate);
                  return (
                    <div key={emp.id} className={`p-4 rounded-lg border flex justify-between items-center ${isRed ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800">{emp.name}</p>
                          {isRed && <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">期限間近</span>}
                        </div>
                        <p className="text-xs text-slate-500">{emp.department} | 付与日: {emp.grantDate}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${isRed ? 'text-red-700' : 'text-amber-700'}`}>消化: {emp.usedDays}日</p>
                        <p className={`text-xs ${isRed ? 'text-red-600 font-bold' : 'text-amber-600'}`}>残: {emp.grantedDays - emp.usedDays}日</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mb-2" />
                  <p>対象者はいません</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 詳細データテーブル */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-gray-300">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800">職員別 詳細データ</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 print:bg-gray-100">
                <tr>
                  <th className="px-6 py-3 font-medium">社員ID</th>
                  <th className="px-6 py-3 font-medium">氏名</th>
                  <th className="px-6 py-3 font-medium">付与日</th>
                  <th className="px-6 py-3 font-medium text-right">付与日数</th>
                  <th className="px-6 py-3 font-medium text-right">消化日数</th>
                  <th className="px-6 py-3 font-medium text-right">消化率</th>
                </tr>
              </thead>
              <tbody>
                {data.map((emp) => {
                  const rate = emp.grantedDays > 0 ? ((emp.usedDays / emp.grantedDays) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors print:break-inside-avoid">
                      <td className="px-6 py-4 text-slate-500">{emp.id}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{emp.name}</td>
                      <td className="px-6 py-4 text-slate-500">{emp.grantDate}</td>
                      <td className="px-6 py-4 text-right text-slate-900">{emp.grantedDays}日</td>
                      <td className="px-6 py-4 text-right text-slate-900">{emp.usedDays}日</td>
                      <td className="px-6 py-4 text-right">
                        {Number(rate) >= 100 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
                            <Crown className="w-3.5 h-3.5 text-amber-500" />
                            {rate}%
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            Number(rate) < 30 ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {rate}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
      </main>
    </div>
  );
}

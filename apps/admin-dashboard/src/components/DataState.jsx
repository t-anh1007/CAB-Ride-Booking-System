export default function DataState({error,children}){return <div className="state">{children||error||"Dữ liệu hiện chưa khả dụng từ gateway. Màn hình chỉ đọc, không gửi thao tác thay đổi."}</div>}

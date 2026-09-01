export function carregarStyles() {

    if (document.querySelector("#erpStyles")) return;

    const style = document.createElement("style");
    style.id = "erpStyles";

    style.textContent = `
        #erpModal{
            position:fixed;
            inset:0;
            background:rgba(0,0,0,.6);
            display:flex;
            align-items:center;
            justify-content:center;
            z-index:999999;
        }

        #erpBox{
            width:350px;
            background:#0f172a;
            padding:25px;
            border-radius:16px;
            display:flex;
            flex-direction:column;
            gap:14px;
        }

        #erpBox h2{
            color:white;
            text-align:center;
            margin:0;
        }

        #erpBox input{
            height:45px;
            border:none;
            border-radius:10px;
            padding:10px;
        }

        #erpBox .erpCheckbox{
            color:white;
            display:flex;
            align-items:center;
            gap:10px;
            font-size:15px;
            user-select:none;
        }

        #erpBox .erpCheckbox input{
            width:18px;
            height:18px;
            padding:0;
        }

        #erpBox button{
            height:45px;
            border:none;
            border-radius:10px;
            background:#38bdf8;
            font-weight:bold;
            cursor:pointer;
        }

        #erpBox #btnFechar{
            background:#334155;
            color:white;
        }
    `;

    document.head.appendChild(style);
}

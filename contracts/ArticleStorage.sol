// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// قرارداد هوشمند جهت مدیریت اصالت و یکپارچگی منابع آموزشی
contract ArticleStorage {
    // IPFS تعریف ساختار داده برای نگاشت شناسه مقاله به آدرس
    mapping(uint256 => string) private articleLinks;
    uint256 public totalRecords;

    // P2P رویداد جهت انتشار خبر ثبت مقاله در سراسر شبکه
    event RecordFinalized(uint256 indexed id, string ipfsAddress);

    // ==========================================================
    // بخش حاکمیت غیرمتمرکز پارامترها
    // ==========================================================
    // پارامترهای حساس سامانه به‌جای اینکه در تنظیمات نرم‌افزاری سمت
    // کلاینت به‌صورت یک‌طرفه تنظیم شوند، در اینجا
    // به‌عنوان متغیرهای عمومی درون‌زنجیره‌ای تعریف می‌شوند تا هرگونه
    // تغییر در آن‌ها قابل استعلام، شفاف و قابل ممیزی باشد.
    //
    // مقیاس‌گذاری: چون سالیدیتی اعشار ندارد، آستانه‌ها بر پایه
    // قسمت در ده‌هزار ذخیره می‌شوند.
    // مثال: آستانه ۰.۴۰ معادل مقدار ۴۰۰۰ است.
    uint256 public lshSimilarityThreshold = 4000; // آستانه شباهت LSH (s)
    uint256 public maxDuplicationRatio = 3000;    // آستانه نرخ تکرار مجاز
    uint256 public minHashBands = 10;             // تعداد نوارهای Min-Hash
    uint256 public minHashRowsPerBand = 2;        // تعداد سطرهای هر نوار

    // آدرس اعضای کنسرسیوم که حق مشارکت در حاکمیت پارامترها را دارند.
    mapping(address => bool) public isConsortiumMember;
    uint256 public consortiumMemberCount;

    // ساختار یک پیشنهاد تغییر پارامتر
    struct ParameterProposal {
        string parameterName; // نام پارامتر هدف (مثلاً "lshSimilarityThreshold")
        uint256 newValue;     // مقدار پیشنهادی جدید
        uint256 voteCount;    // تعداد آرای موافق تاکنون
        bool executed;        // آیا این پیشنهاد قبلاً اعمال شده است
    }

    ParameterProposal[] public proposals;
    // جلوگیری از رأی مضاعف هر عضو برای یک پیشنهاد مشخص
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ParameterProposed(uint256 indexed proposalId, string parameterName, uint256 newValue, address proposer);
    event ParameterVoteCast(uint256 indexed proposalId, address voter, uint256 currentVotes);
    event ParameterUpdated(string parameterName, uint256 newValue);

    // فقط اعضای کنسرسیوم مجاز به پیشنهاد و رأی‌گیری هستند
    modifier onlyConsortiumMember() {
        require(isConsortiumMember[msg.sender], "Error: Not a consortium member!");
        _;
    }

    /**
     * @dev سازنده قرارداد؛ استقرار دهنده به‌عنوان اولین عضو کنسرسیوم ثبت می‌شود.
     * در پیاده‌سازی فعلی (تک‌گره) همین یک عضو کافی است؛ افزودن اعضای
     * بیشتر از طریق addConsortiumMember در آینده انجام خواهد شد.
     */
    constructor() {
        isConsortiumMember[msg.sender] = true;
        consortiumMemberCount = 1;
    }

    /**
     * @dev افزودن عضو جدید به کنسرسیوم (فعلاً توسط اعضای موجود قابل انجام است؛
     * در نسخه‌های بعدی می‌توان این عملیات را نیز مشمول رأی‌گیری کرد).
     */
    function addConsortiumMember(address _member) external onlyConsortiumMember {
        require(!isConsortiumMember[_member], "Error: Already a member!");
        isConsortiumMember[_member] = true;
        consortiumMemberCount++;
    }

    /**
     * @dev ثبت یک پیشنهاد برای تغییر یکی از پارامترهای حساس سامانه.
     * این تابع صرفاً «پیشنهاد» را ثبت می‌کند؛ اعمال واقعی تغییر منوط
     * به رسیدن به آستانه رأی اکثریت در تابع voteOnProposal است.
     */
    function proposeParameterChange(string memory _parameterName, uint256 _newValue)
        external
        onlyConsortiumMember
        returns (uint256 proposalId)
    {
        proposals.push(ParameterProposal({
            parameterName: _parameterName,
            newValue: _newValue,
            voteCount: 0,
            executed: false
        }));

        proposalId = proposals.length - 1;
        emit ParameterProposed(proposalId, _parameterName, _newValue, msg.sender);
    }

    /**
     * @dev رأی موافق یک عضو کنسرسیوم به یک پیشنهاد تغییر پارامتر.
     * به محض رسیدن آرا به اکثریت (بیش از نیمی از اعضا)، تغییر به‌صورت
     * خودکار اعمال و رویداد ParameterUpdated صادر می‌شود.
     */
    function voteOnProposal(uint256 _proposalId) external onlyConsortiumMember {
        require(_proposalId < proposals.length, "Error: Invalid proposal!");
        ParameterProposal storage proposal = proposals[_proposalId];

        require(!proposal.executed, "Error: Proposal already executed!");
        require(!hasVoted[_proposalId][msg.sender], "Error: Already voted!");

        hasVoted[_proposalId][msg.sender] = true;
        proposal.voteCount++;

        emit ParameterVoteCast(_proposalId, msg.sender, proposal.voteCount);

        // بررسی رسیدن به آستانه اکثریت (بیش از نیمی از اعضای کنسرسیوم)
        if (proposal.voteCount * 2 > consortiumMemberCount) {
            _executeProposal(proposal);
        }
    }

    /**
     * @dev اعمال داخلی مقدار جدید روی متغیر عمومی متناظر پس از تصویب.
     */
    function _executeProposal(ParameterProposal storage proposal) private {
        bytes32 nameHash = keccak256(bytes(proposal.parameterName));

        if (nameHash == keccak256(bytes("lshSimilarityThreshold"))) {
            lshSimilarityThreshold = proposal.newValue;
        } else if (nameHash == keccak256(bytes("maxDuplicationRatio"))) {
            maxDuplicationRatio = proposal.newValue;
        } else if (nameHash == keccak256(bytes("minHashBands"))) {
            minHashBands = proposal.newValue;
        } else if (nameHash == keccak256(bytes("minHashRowsPerBand"))) {
            minHashRowsPerBand = proposal.newValue;
        } else {
            revert("Error: Unknown parameter name!");
        }

        proposal.executed = true;
        emit ParameterUpdated(proposal.parameterName, proposal.newValue);
    }

    /**
     * @dev IPFS تابع ثبت پیوند میان مقاله و هویت دیجیتال آن در
     * این تابع پس از تایید اصالت در لایه مدل زبانی فراخوانی می‌شود.
     */
    function storeIntegrityLink(uint256 _articleId, string memory _cid) public {
        // شرط عدم وجود سابقه قبلی برای جلوگیری از جعل مالکیت
        require(bytes(articleLinks[_articleId]).length == 0, "Error: Proof already exists!");
        // شرط معتبر بودن آدرس فایل
        require(bytes(_cid).length > 0, "Error: Invalid CID!");

        // ثبت نهایی در لایه ذخیره‌سازی بلاک‌چین (تغییر ناپذیر)
        articleLinks[_articleId] = _cid;
        totalRecords++;

        // صدور رویداد جهت ثبت در تاریخچه بلوک‌ها
        emit RecordFinalized(_articleId, _cid);
    }

    /**
     * @dev تابع استعلام و بازخوانی پیوند جهت داوری در شبکه
     */
    function verifyIntegrity(uint256 _articleId) external view returns (string memory) {
        return articleLinks[_articleId];
    }
}
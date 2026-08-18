import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect
} from "react";

import {
  loginUser,
  registerUser
} from "../api/auth.js";
import { registerAffiliateUser } from "../api/affiliateAuth.js";

import {
  getBusiness
} from "../api/business.js";

const AuthContext = createContext(null);

const normalizeUser = (user) => ({
  ...user,
  industryType: user?.industryType || "retail",
  isPro: user?.isPro === true
});

const storedUser = () => {
  try {
    const raw = JSON.parse(localStorage.getItem("bms_user"));
    return raw ? normalizeUser(raw) : null;
  } catch {
    return null;
  }
};

const storedBusiness = () => {
  try {
    return JSON.parse(localStorage.getItem("bms_business")) || null;
  } catch {
    return null;
  }
};

export const usePermissions = (user, business) => {
  if (!user) {
    return {
      isPro: false,
      role: "guest",
      canManage: false,
      canSell: false,
      businessPlan: "free",
      isBusinessPremium: false
    };
  }

  const businessPlan = business?.subscription?.plan;
  const subscriptionStatus = business?.subscription?.status;
  const inheritedPlan = businessPlan || user.businessPlan || "free";

  const isPro =
    business?.isPro === true ||
    (user.role === "owner"
      ? inheritedPlan === "pro" && subscriptionStatus === "active"
      :
        (inheritedPlan === "pro" && subscriptionStatus === "active") ||
        user.isBusinessPremium === true);

  return {
    isPro,
    role: user.role,
    canManage: user.role === "owner",
    canSell:
      user.role === "owner" ||
      user.role === "staff" ||
      user.role === "manager" ||
      user.role === "cashier",
    businessPlan: inheritedPlan,
    isBusinessPremium: isPro
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(storedUser);

  const [token, setToken] = useState(
    localStorage.getItem("bms_token")
  );

  const [business, setBusiness] = useState(storedBusiness);

  const [loadingBusiness, setLoadingBusiness] =
    useState(true);

  const [impersonatedBusiness, setImpersonatedBusiness] =
    useState(null);

  // 🔥 LOAD IMPERSONATION
  useEffect(() => {
    const saved = localStorage.getItem(
      "bms_impersonation"
    );

    // 🔥 ONLY SUPER ADMIN SHOULD KEEP IMPERSONATION
    if (saved && user?.role === "super_admin") {
      setImpersonatedBusiness(saved);
    } else {
      localStorage.removeItem("bms_impersonation");
    }
  }, [user]);

  // 🔥 LOAD BUSINESS
  const businessFallback = {
    name: "Loading Profile...",
    industryType: "retail"
  };

  useEffect(() => {
    if (!token) {
      setBusiness(null);
      setLoadingBusiness(false);
      return;
    }

    if (user?.role === "super_admin") {
      setBusiness(null);
      setLoadingBusiness(false);
      return;
    }
    
    let isMounted = true;

    const run = async () => {
      try {
        setLoadingBusiness(true);

        const data = await getBusiness();

        if (!isMounted) return;

        setBusiness(data || businessFallback);
        if (data) {
          localStorage.setItem("bms_business", JSON.stringify(data));
        }

      } catch (err) {
        console.error(
          "Business load failed:",
          err.message
        );

        if (!isMounted) return;

        setBusiness(businessFallback);

      } finally {
        if (isMounted) {
          setLoadingBusiness(false);
        }
      }
    };

    run();

    return () => {
      isMounted = false;
    };

  }, [token, impersonatedBusiness]);

  // 🔥 SESSION PERSIST
  const persistSession = (session) => {
    // 🔥 CLEAR OLD IMPERSONATION ON NEW LOGIN
    localStorage.removeItem("bms_impersonation");

    localStorage.setItem(
      "bms_token",
      session.token
    );

    if (session.refreshToken) {
      localStorage.setItem(
        "bms_refresh",
        session.refreshToken
      );
    }

    const normalizedUser = normalizeUser(session.user || {});

    localStorage.setItem(
      "bms_user",
      JSON.stringify(normalizedUser)
    );

    if (session.business) {
      localStorage.setItem("bms_business", JSON.stringify(session.business));
    }

    setToken(session.token);
    setUser(normalizedUser);

    setImpersonatedBusiness(null);
  };

  // 🔥 LOGIN
  const login = async (payload) => {
    const session = await loginUser(payload);

    persistSession(session);

    return session;
  };

  // 🔥 REGISTER
  const register = async (payload) => {
    const session = await registerUser(payload);

    persistSession(session);

    return session;
  };

  const registerAffiliate = async (payload) => {
    const session = await registerAffiliateUser(payload);

    persistSession(session);

    return session;
  };

  // 🔥 LOGOUT
  const logout = () => {
    localStorage.removeItem("bms_token");

    localStorage.removeItem("bms_refresh");

    localStorage.removeItem("bms_user");

    localStorage.removeItem("bms_business");

    localStorage.removeItem(
      "bms_impersonation"
    );

    setToken(null);

    setUser(null);

    setBusiness(null);

    setImpersonatedBusiness(null);

    // 🔥 HARD RESET
    window.location.replace("/login");
  };

  // 🔥 MANUAL REFRESH
  const refreshBusiness = async () => {
    try {
      setLoadingBusiness(true);

      const data = await getBusiness();

      setBusiness(data || businessFallback);
      if (data) {
        localStorage.setItem("bms_business", JSON.stringify(data));
      }

    } catch (err) {
      console.error(err);

      setBusiness(businessFallback);

    } finally {
      setLoadingBusiness(false);
    }
  };

  // 🔥 DERIVED STATE
  const permissions = usePermissions(user, business);
  const isPro = permissions.isPro;
  const subscriptionStatus = business?.subscription?.status;
  const expiresAt = business?.subscription?.expiresAt;
  const industryType =
    user?.industryType || business?.industryType || "retail";

  const authUser = useMemo(() => {
    if (!user) return null;

    return {
      ...user,
      industryType,
      isPro
    };
  }, [user, industryType, isPro]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token && authUser),

      login,
      logout,
      register,
      registerAffiliate,

      user: authUser,

      business,

      industryType,

      businessType: business?.businessType || "general_services",

      isPro,

      permissions,

      businessPlan: permissions.businessPlan,

      isBusinessPremium: permissions.isBusinessPremium,

      subscriptionStatus,

      expiresAt,

      loadingBusiness,

      refreshBusiness,

      impersonatedBusiness,

      startImpersonation: (id) => {
        if (user?.role !== "super_admin") return;

        localStorage.setItem(
          "bms_impersonation",
          id
        );

        setImpersonatedBusiness(id);
      },

      stopImpersonation: () => {
        localStorage.removeItem(
          "bms_impersonation"
        );

        setImpersonatedBusiness(null);
      }
    }),
    [
      token,
      user,
      business,
      impersonatedBusiness,
      loadingBusiness
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }

  return context;
};
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User, Settings } from "lucide-react";

export const UserHeader = () => {
  const { user, profile, userRoles, signOut, isAdmin, isNutritionist } = useAuth();

  if (!user) return null;

  const displayName = profile?.first_name 
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : user.email;

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || 'U';
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'nutritionist':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-secondary/10 text-secondary-foreground border-secondary/20';
    }
  };

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-card border-b border-border">
      <div className="flex items-center gap-2">
        {userRoles.map((role) => (
          <Badge 
            key={role.id} 
            variant="secondary" 
            className={getRoleColor(role.role)}
          >
            {role.role === 'admin' ? 'Administrador' : 
             role.role === 'nutritionist' ? 'Nutricionista' : 'Visualizador'}
          </Badge>
        ))}
      </div>
      
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || ""} alt={displayName} />
                <AvatarFallback>{getInitials()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};